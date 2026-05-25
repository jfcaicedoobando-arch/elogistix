/**
 * Test de arquitectura — protege la jerarquía de capas:
 *   src/lib/** NO puede importar de @/hooks/*, @/components/* ni @/pages/*.
 *
 * Duplica la regla ESLint `no-restricted-imports` definida en eslint.config.js
 * como red de seguridad ante eliminaciones accidentales del lint rule.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = /from\s+["']@\/(hooks|components|pages)\//;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry) && !p.includes("__tests__")) out.push(p);
  }
  return out;
}

describe("Arquitectura: src/lib no depende de capas superiores", () => {
  it("ningún archivo en src/lib importa @/hooks, @/components o @/pages", () => {
    const files = walk("src/lib");
    const violators: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (FORBIDDEN.test(src)) violators.push(f);
    }
    expect(violators, `Violaciones de capa:\n${violators.join("\n")}`).toEqual([]);
  });
});
