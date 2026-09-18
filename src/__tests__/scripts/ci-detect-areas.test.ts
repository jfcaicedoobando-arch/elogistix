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
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(process.cwd(), "scripts/ci/detect-areas.sh");

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
function commit(rutas: string[], padre?: string): string {
  const index = join(repo, `idx-${Math.random().toString(36).slice(2)}`);
  const env = { GIT_INDEX_FILE: index };
  const blobPath = join(repo, "blob.tmp");
  writeFileSync(blobPath, `contenido ${Math.random()}\n`);
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
    env: { ...process.env, GITHUB_OUTPUT: outFile, ...env },
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
  base = commit(["README.md"]);
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("scripts/ci/detect-areas.sh", () => {
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

  it("sin base utilizable corre TODO (conservador)", () => {
    expect(detectar({ EVENT_NAME: "workflow_dispatch", HEAD_SHA: base })).toMatchObject({
      frontend: "true",
      edge: "true",
      database: "true",
    });
  });

  it("base inexistente o diff vacío corre TODO (conservador)", () => {
    expect(
      detectar({ EVENT_NAME: "push", BEFORE_SHA: "0".repeat(40), HEAD_SHA: base }),
    ).toMatchObject({ frontend: "true", edge: "true", database: "true" });
    // Mismo commit en base y head → diff vacío.
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: base, HEAD_SHA: base })).toMatchObject({
      frontend: "true",
      edge: "true",
      database: "true",
    });
  });
});
