/**
 * Test de arquitectura — protege la jerarquía de capas:
 *   - `src/lib/**` NO puede importar de @/hooks, @/components ni @/pages.
 *   - `src/services/**` NO puede importar de @/hooks, @/components,
 *     @/pages ni @/contexts.
 *
 * Duplica las reglas ESLint `no-restricted-imports` definidas en
 * eslint.config.js como red de seguridad ante eliminaciones accidentales.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry) && !p.includes("__tests__")) out.push(p);
  }
  return out;
}

function findViolators(root: string, pattern: RegExp): string[] {
  const violators: string[] = [];
  for (const f of walk(root)) {
    const src = readFileSync(f, "utf8");
    if (pattern.test(src)) violators.push(f);
  }
  return violators;
}

describe("Arquitectura: jerarquía de capas Pages→Hooks→Services→Lib", () => {
  it("src/lib no importa @/hooks, @/components o @/pages", () => {
    const pattern = /from\s+["']@\/(hooks|components|pages)\//;
    const violators = findViolators("src/lib", pattern);
    expect(violators, `Violaciones en lib/:\n${violators.join("\n")}`).toEqual([]);
  });

  it("src/services no importa @/hooks, @/components, @/pages o @/contexts", () => {
    const pattern = /from\s+["']@\/(hooks|components|pages|contexts)\//;
    const violators = findViolators("src/services", pattern);
    expect(violators, `Violaciones en services/:\n${violators.join("\n")}`).toEqual([]);
  });
});
