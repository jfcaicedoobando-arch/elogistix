/**
 * Guardarraíl UI-2 (Ola B · auditoría externa 2026-08-19).
 *
 * La antigüedad de cartera se pinta con UNA sola escala: los tokens
 * `--aging-1..5` expuestos por `src/lib/aging/buckets.ts`. Ningún módulo puede
 * volver a inventar su propio color por rango de días, porque entonces la misma
 * deuda se ve distinta en Cobranza, Tesorería, CxC y CxP.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");

/** Únicos archivos autorizados a nombrar las clases `*-aging-N`. */
const DUENOS = [
  "src/lib/aging/buckets.ts",
  "src/features/tesoreria/domain/agingTone.ts",
];

const CLASE_AGING = /(?:bg|text|border|ring)-aging-[1-5]/;

describe("UI-2 · escala única de antigüedad", () => {
  it("solo el catálogo central define clases de color de aging", () => {
    const ofensores: string[] = [];
    for (const f of walk(join(ROOT, "src"), {
      excludeDirs: ["node_modules", "__tests__"],
      excludeFileRe: /\.(test|spec)\.tsx?$/,
    })) {
      if (!/\.(ts|tsx)$/.test(f)) continue;
      const rel = relPath(ROOT, f);
      if (DUENOS.includes(rel)) continue;
      if (CLASE_AGING.test(readFileSync(f, "utf8"))) ofensores.push(rel);
    }
    expect(ofensores).toEqual([]);
  });

  it("los helpers de facturación derivan el color del catálogo, no a mano", () => {
    const src = readFileSync(join(ROOT, "src/features/facturacion/utils/aging.ts"), "utf8");
    expect(src).toContain("AGING_SOLID_CLASS");
    const adhoc = src
      .split("\n")
      .filter((l) => /className:\s*"(?:bg|text)-(?:warning|destructive|success)/.test(l));
    expect(adhoc).toEqual([]);
  });
});
