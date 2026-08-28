/**
 * Ola I · candado de tamaño de iconos.
 *
 * El design system usa la utilidad corta `size-4` (equivalente a `h-4 w-4`).
 * Mantener las dos formas en paralelo hace que un cambio de escala haya que
 * buscarlo dos veces. No se exige migrar los 954 usos históricos hoy: se
 * congela el conteo (ratchet) para que el código nuevo use `size-4`. Cuando
 * migres archivos, baja el tope aquí.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sync as globSync } from "fast-glob";

/**
 * Ola 5 · RN-1 — holgura documentada: el tope es la deuda congelada + 10.
 * Sin holgura, cualquier PR inocente rompía CI. Plan: bajar el tope cada
 * trimestre a `deuda_actual + 10` conforme se migran archivos.
 *
 * FIX-R3 (review_ola3 H2): baseline real verificado con este mismo regex —
 * 907 ocurrencias al 2026-08-31 (el baseline previo, 900, mentía por abajo).
 */
// v13.777.7 — baseline recontado tras la migración de estados vacíos/tipografía.
const DEUDA_CONGELADA = 921;
const HOLGURA = 10;
const MAX_PAR_LARGO = DEUDA_CONGELADA + HOLGURA;

function contarParLargo(): { total: number; porArchivo: Record<string, number> } {
  const archivos = globSync("src/**/*.tsx", {
    ignore: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx", "src/test/**"],
  });
  const porArchivo: Record<string, number> = {};
  let total = 0;
  for (const archivo of archivos) {
    const ocurrencias = readFileSync(archivo, "utf8").match(/\bh-4 w-4\b/g)?.length ?? 0;
    if (ocurrencias > 0) {
      porArchivo[archivo] = ocurrencias;
      total += ocurrencias;
    }
  }
  return { total, porArchivo };
}

describe("arquitectura · ratchet de tamaño de iconos", () => {
  it(`no supera ${MAX_PAR_LARGO} usos de "h-4 w-4" (usa size-4 en código nuevo)`, () => {
    const { total, porArchivo } = contarParLargo();
    expect(
      total,
      `Se detectaron ${total} usos de "h-4 w-4" (tope ${MAX_PAR_LARGO}). ` +
        `En código nuevo usa \`size-4\`. Archivos con más ocurrencias: ` +
        JSON.stringify(
          Object.fromEntries(
            Object.entries(porArchivo)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10),
          ),
          null,
          2,
        ),
    ).toBeLessThanOrEqual(MAX_PAR_LARGO);
  });

  it("mantiene el tope de iconos h-4 w-4 sincronizado (si migraste archivos, baja el tope)", () => {
    const { total } = contarParLargo();
    expect(
      // FIX-R3: chequeo bidireccional — antes era unilateral y no detectaba
      // un baseline POR DEBAJO del conteo real (900 vs 907).
      Math.abs(DEUDA_CONGELADA - total),
      "Hay margen de sobra en el ratchet: ajusta DEUDA_CONGELADA al conteo real.",
    ).toBeLessThanOrEqual(HOLGURA);
  });
});
