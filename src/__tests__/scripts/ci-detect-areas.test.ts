/**
 * Detector de áreas de CI (`scripts/ci/detect-areas.sh`).
 *
 * Regresión: un commit que sólo toca Markdown con acentos/ñ (ruta que git
 * entrecomilla con `core.quotePath`) NO debe activar los jobs de frontend.
 *
 * Los commits de prueba se arman con plumbing (`hash-object`, `update-index`,
 * `write-tree`, `commit-tree`) sobre un repo temporal: nada toca este repo.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const SCRIPT = join(process.cwd(), "scripts/ci/detect-areas.sh");
// CI runs this integration test on Linux. On Windows, skip only if bash truly
// is not installed instead of failing the whole local Vitest run with ENOENT.
const BASH_DISPONIBLE = spawnSync("bash", ["--version"], { stdio: "ignore" }).status === 0;
const FULL_RUN = { frontend: "true", edge: "true", database: "true", workflows: "true" };
const EMPTY_DIFF = { frontend: "false", edge: "false", database: "false", workflows: "false" };

const IDENTIDAD = {
  GIT_AUTHOR_NAME: "CI",
  GIT_AUTHOR_EMAIL: "ci@example.com",
  GIT_COMMITTER_NAME: "CI",
  GIT_COMMITTER_EMAIL: "ci@example.com",
};

let repo: string;

function git(args: string[], env: Record<string, string> = {}): string {
  return execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, ...IDENTIDAD, ...env },
  }).trim();
}

/** Crea un commit con las rutas dadas (contenido irrelevante). */
function commit(rutas: string[], padre?: string, contenido = `contenido ${Math.random()}\n`): string {
  const index = join(repo, `idx-${Math.random().toString(36).slice(2)}`);
  const env = { GIT_INDEX_FILE: index };
  const blobPath = join(repo, "blob.tmp");
  writeFileSync(blobPath, contenido);
  const blob = git(["hash-object", "-w", blobPath]);
  for (const r of rutas) {
    git(["update-index", "--add", "--cacheinfo", `100644,${blob},${r}`], env);
  }
  const tree = git(["write-tree"], env);
  const args = ["commit-tree", tree, "-m", "prueba"];
  if (padre) args.push("-p", padre);
  return git(args, env);
}

/** Corre el detector como en CI y devuelve las salidas escritas. */
function detectar(env: Record<string, string>): Record<string, string> {
  const outFile = join(repo, `out-${Math.random().toString(36).slice(2)}.txt`);
  writeFileSync(outFile, "");
  execFileSync("bash", [SCRIPT], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      EVENT_NAME: "",
      BASE_SHA: "",
      BEFORE_SHA: "",
      HEAD_SHA: "",
      GITHUB_OUTPUT: outFile,
      ...env,
    },
  });
  const salidas: Record<string, string> = {};
  for (const linea of readFileSync(outFile, "utf8").split("\n")) {
    const [k, v] = linea.split("=");
    if (k && v !== undefined) salidas[k] = v;
  }
  return salidas;
}

let base: string;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "detect-areas-"));
  git(["init", "-q", "-b", "main"]);
  // Reproduce el entorno real: git entrecomilla rutas no ASCII.
  git(["config", "core.quotePath", "true"]);
  git(["config", "diff.renames", "true"]);
  base = commit(["README.md"]);
  git(["update-ref", "refs/heads/main", base]);
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe.skipIf(!BASH_DISPONIBLE)("scripts/ci/detect-areas.sh", () => {
  it("Markdown con acentos/ñ no activa frontend", () => {
    const head = commit(
      [".lovable/plan/factura-que-no-timbra-por-la-fecha-del-día-anterior-ñ.md"],
      base,
    );
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: base, HEAD_SHA: head })).toMatchObject({
      frontend: "false",
      edge: "false",
      database: "false",
    });
  });

  it("un archivo de código sí activa frontend", () => {
    const head = commit(["src/features/demo/Componente.tsx"], base);
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: base, HEAD_SHA: head })).toMatchObject({
      frontend: "true",
    });
  });

  it.each(["scripts/check-edge-entrypoints.sh", "tests/contracts/money.json"])("%s activates Edge adapter verification", (ruta) => {
    const head = commit([ruta], base);
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: base, HEAD_SHA: head })).toMatchObject({ edge: "true" });
  });

  it.each(["workflow_dispatch", "schedule", "merge_group", "desconocido", ""])(
    "el evento %s conserva TODO incluso con base y head iguales",
    (event) => {
      expect(detectar({ EVENT_NAME: event, BASE_SHA: base, BEFORE_SHA: base, HEAD_SHA: base }))
        .toEqual(FULL_RUN);
    },
  );

  it.each(["push", "pull_request"])("%s con base igual a head es un diff válido vacío", (event) => {
    expect(detectar({ EVENT_NAME: event, BASE_SHA: base, BEFORE_SHA: base, HEAD_SHA: base }))
      .toEqual(EMPTY_DIFF);
  });

  it("un commit vacío distinto de su padre no activa áreas", () => {
    const tree = git(["rev-parse", `${base}^{tree}`]);
    const head = git(["commit-tree", tree, "-p", base, "-m", "commit vacío"]);
    expect(head).not.toBe(base);
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: base, HEAD_SHA: head })).toEqual(EMPTY_DIFF);
  });

  it("un PR sin delta de árbol no activa áreas", () => {
    const tree = git(["rev-parse", `${base}^{tree}`]);
    const head = git(["commit-tree", tree, "-p", base, "-m", "PR sin delta"]);
    expect(detectar({ EVENT_NAME: "pull_request", BASE_SHA: base, HEAD_SHA: head })).toEqual(EMPTY_DIFF);
  });

  it("HEAD sigue siendo el default cuando no se pasa HEAD_SHA", () => {
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: base })).toEqual(EMPTY_DIFF);
  });

  it.each([
    "drizzle/migrations/0005_pricing.sql",
    "drizzle/migrations/meta/_journal.json",
    "drizzle/schema.ts",
    "drizzle.config.ts",
    "drizzle/replay.json",
    "scripts/db/local-verify.sh",
    "scripts/ci/detect-areas.sh",
  ])("%s activa las comprobaciones de BD", (ruta) => {
    const head = commit([ruta], base);
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: base, HEAD_SHA: head })).toMatchObject({
      frontend: ruta.endsWith(".sql") ? "false" : "true",
      database: "true",
    });
  });

  it.each([
    ["supabase/migrations/new.sql", "false", "false", "true", "false"],
    ["supabase/schema/function.sql", "false", "false", "true", "false"],
    ["supabase/tests/check.sql", "false", "false", "true", "false"],
    ["supabase/functions/new/index.ts", "true", "true", "false", "false"],
    ["package.json", "true", "false", "true", "false"],
    ["unknown/new.config", "true", "false", "false", "false"],
    [".github/workflows/e2e.yml", "true", "false", "false", "true"],
    ["scripts/ci/lint-workflows.sh", "true", "false", "false", "true"],
    [".github/dependabot.yml", "true", "false", "false", "true"],
    ["scripts/ci/test-catalog.mjs", "true", "false", "false", "false"],
    ["scripts/ci/test-catalog/sql-support.json", "true", "false", "false", "false"],
    ["scripts/ci/verify-test-evidence.mjs", "true", "false", "false", "false"],
    ["scripts/ci/vitest-evidence-reporter.ts", "true", "false", "false", "false"],
    ["scripts/__tests__/audit-acl-preservation.test.ts", "true", "false", "false", "false"],
  ])("clasifica %s sin perder verificaciones", (ruta, frontend, edge, database, workflows) => {
    const head = commit([ruta], base);
    expect(detectar({ EVENT_NAME: "pull_request", BASE_SHA: base, HEAD_SHA: head }))
      .toEqual({ frontend, edge, database, workflows });
  });

  it("un diff mixto SQL/UI conserva frontend y BD", () => {
    const head = commit(["supabase/migrations/new.sql", "src/App.tsx"], base);
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: base, HEAD_SHA: head }))
      .toMatchObject({ frontend: "true", database: "true" });
  });

  it.each(["", "0".repeat(40), "f".repeat(40), "referencia-inexistente"])(
    "una base ausente o inválida (%s) conserva TODO",
    (invalidBase) => {
      for (const event of ["push", "pull_request"]) {
        expect(detectar({ EVENT_NAME: event, BEFORE_SHA: invalidBase, BASE_SHA: invalidBase, HEAD_SHA: base }))
          .toEqual(FULL_RUN);
      }
    },
  );

  it("una base que existe como blob no cuenta como commit válido", () => {
    const blob = git(["rev-parse", `${base}:README.md`]);
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: blob, HEAD_SHA: base })).toEqual(FULL_RUN);
  });

  it("un head inválido conserva TODO", () => {
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: base, HEAD_SHA: "head-inexistente" }))
      .toEqual(FULL_RUN);
  });

  it.each(["", "docs/parcial.md"])("un git diff fallido no acepta salida parcial '%s'", (partial) => {
    const bin = mkdtempSync(join(repo, "fake-bin-"));
    // Sólo falla diff; la validación previa de ambos commits continúa siendo real.
    writeFileSync(join(bin, "git"), [
      "#!/usr/bin/env bash",
      'if [ "$1" = diff ]; then',
      '  if [ -n "$PARTIAL_DIFF" ]; then printf "%s\\0" "$PARTIAL_DIFF"; fi',
      "  exit 1",
      "fi",
      'exec "$REAL_GIT" "$@"',
      "",
    ].join("\n"), { mode: 0o755 });
    const realGit = execFileSync("bash", ["-c", "command -v git"], { encoding: "utf8" }).trim();
    expect(detectar({
      EVENT_NAME: "push", BEFORE_SHA: base, HEAD_SHA: base,
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`, REAL_GIT: realGit, PARTIAL_DIFF: partial,
    })).toEqual(FULL_RUN);
  });

  it("si no se puede preparar el archivo del diff conserva TODO", () => {
    expect(detectar({
      EVENT_NAME: "push", BEFORE_SHA: base, HEAD_SHA: base,
      TMPDIR: join(repo, "carpeta-inexistente"),
    })).toEqual(FULL_RUN);
  });

  it.each([
    ["src/Componente.tsx", "docs/Componente.md", "true", "false"],
    ["supabase/migrations/previa.sql", "docs/previa.md", "false", "true"],
    ["docs/anterior-ñ.md", "docs/nueva-con-á.md", "false", "false"],
  ])("renombrar %s a %s conserva la clasificación de ambos extremos", (origin, destination, frontend, database) => {
    const contenido = "mismo contenido para que Git detecte el rename\n";
    const before = commit([origin], undefined, contenido);
    const head = commit([destination], before, contenido);
    expect(git(["diff", "--name-status", "--find-renames", before, head])).toContain("R100");
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: before, HEAD_SHA: head }))
      .toEqual({ frontend, edge: "false", database, workflows: "false" });
  });

  it.each([
    ["src/Eliminado.tsx", "true", "false", "false", "false"],
    ["supabase/migrations/eliminada.sql", "false", "false", "true", "false"],
    ["supabase/functions/eliminada/index.ts", "true", "true", "false", "false"],
    [".github/workflows/eliminado.yml", "true", "false", "false", "true"],
    ["docs/eliminado.md", "false", "false", "false", "false"],
  ])("borrar %s conserva sus comprobaciones", (path, frontend, edge, database, workflows) => {
    const before = commit([path]);
    const head = commit([], before);
    expect(detectar({ EVENT_NAME: "pull_request", BASE_SHA: before, HEAD_SHA: head }))
      .toEqual({ frontend, edge, database, workflows });
  });

  it("preserva Unicode, espacios, tabs y saltos de línea sin partir rutas", () => {
    const head = commit(["docs/con acento-ñ\nsegunda\tlínea.md", "src/nombre extraño-ñ\narchivo.tsx"], base);
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: base, HEAD_SHA: head }))
      .toEqual({ ...EMPTY_DIFF, frontend: "true" });
  });
});
