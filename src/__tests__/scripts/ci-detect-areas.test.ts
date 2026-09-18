/**
 * Detector de áreas de CI (`scripts/ci/detect-areas.sh`).
 *
 * Regresión: un commit que sólo toca Markdown con acentos/ñ (ruta que git
 * entrecomilla con `core.quotePath`) NO debe activar los jobs de frontend.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const SCRIPT = join(process.cwd(), "scripts/ci/detect-areas.sh");

let repo: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

function commit(rutas: string[], mensaje: string): string {
  for (const r of rutas) {
    const abs = join(repo, r);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, `contenido ${Date.now()}\n`);
  }
  git("add", "-A");
  git("commit", "-m", mensaje);
  return git("rev-parse", "HEAD");
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

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "detect-areas-"));
  git("init", "-q", "-b", "main");
  git("config", "user.email", "ci@example.com");
  git("config", "user.name", "CI");
  // Reproduce el entorno real: git entrecomilla rutas no ASCII.
  git("config", "core.quotePath", "true");
  commit(["README.md"], "inicial");
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("scripts/ci/detect-areas.sh", () => {
  it("Markdown con acentos/ñ no activa frontend", () => {
    const base = git("rev-parse", "HEAD");
    const head = commit(
      [".lovable/plan/factura-que-no-timbra-por-la-fecha-del-día-anterior-ñ.md"],
      "docs con acentos",
    );
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: base, HEAD_SHA: head })).toMatchObject({
      frontend: "false",
      edge: "false",
      database: "false",
    });
  });

  it("un archivo de código sí activa frontend", () => {
    const base = git("rev-parse", "HEAD");
    const head = commit(["src/features/demo/Componente.tsx"], "código");
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: base, HEAD_SHA: head })).toMatchObject({
      frontend: "true",
    });
  });

  it("sin base utilizable corre TODO (conservador)", () => {
    const head = git("rev-parse", "HEAD");
    expect(detectar({ EVENT_NAME: "workflow_dispatch", HEAD_SHA: head })).toMatchObject({
      frontend: "true",
      edge: "true",
      database: "true",
    });
  });

  it("base inexistente o diff vacío corre TODO (conservador)", () => {
    const head = git("rev-parse", "HEAD");
    expect(
      detectar({ EVENT_NAME: "push", BEFORE_SHA: "0".repeat(40), HEAD_SHA: head }),
    ).toMatchObject({ frontend: "true", edge: "true", database: "true" });
    // Mismo commit en base y head → diff vacío.
    expect(detectar({ EVENT_NAME: "push", BEFORE_SHA: head, HEAD_SHA: head })).toMatchObject({
      frontend: "true",
      edge: "true",
      database: "true",
    });
  });
});
