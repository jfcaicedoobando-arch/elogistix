/**
 * Ola I · candado de `toFixed` en componentes.
 *
 * Los importes y porcentajes que ve el usuario deben salir de los
 * formateadores canónicos (`formatCurrency`, `formatPorcentaje`,
 * `formatNumero`): ellos aplican locale es-MX, separador de miles y la moneda
 * explícita. `toFixed` produce "1234.5" sin moneda ni separadores y se cuela
 * fácil en la UI. No se exige migrar los 99 usos históricos hoy: se congela el
 * conteo para que el código nuevo use los formateadores. Al migrar, baja el
 * tope aquí.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sync as globSync } from "fast-glob";

/**
 * Ola 5 · RN-1 — holgura documentada: el tope es la deuda congelada + 10.
 * Sin holgura, cualquier PR inocente rompía CI. Plan: bajar el tope cada
 * trimestre a `deuda_actual + 10` conforme se migran archivos.
 */
const DEUDA_CONGELADA = 99;
const HOLGURA = 10;
const MAX_TOFIXED = DEUDA_CONGELADA + HOLGURA;

function contarToFixed(): { total: number; porArchivo: Record<string, number> } {
  const archivos = globSync("src/**/*.tsx", {
    ignore: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx", "src/test/**"],
  });
  const porArchivo: Record<string, number> = {};
  let total = 0;
  for (const archivo of archivos) {
    const ocurrencias = readFileSync(archivo, "utf8").match(/\.toFixed\(/g)?.length ?? 0;
    if (ocurrencias > 0) {
      porArchivo[archivo] = ocurrencias;
      total += ocurrencias;
    }
  }
  return { total, porArchivo };
}

describe("arquitectura · ratchet de toFixed en .tsx", () => {
  it(`no supera ${MAX_TOFIXED} usos de toFixed en componentes`, () => {
    const { total, porArchivo } = contarToFixed();
    expect(
      total,
      `Se detectaron ${total} usos de toFixed en .tsx (tope ${MAX_TOFIXED}). ` +
        `Usa formatCurrency / formatPorcentaje / formatNumero de @/lib/formatters. Detalle: ` +
        JSON.stringify(
          Object.fromEntries(
            Object.entries(porArchivo)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10),
          ),
          null,
          2,
        ),
    ).toBeLessThanOrEqual(MAX_TOFIXED);
  });

  it("mantiene el tope sincronizado (si migraste archivos, baja el tope)", () => {
    const { total } = contarToFixed();
    expect(
      MAX_TOFIXED - total,
      "Hay margen de sobra en el ratchet: ajusta MAX_TOFIXED al conteo real.",
    ).toBeLessThanOrEqual(5);
  });
});
