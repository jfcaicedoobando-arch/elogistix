/**
 * Guardrail (Auditoría · Punto 8) — dispersión de lecturas.
 *
 * `select("*")` trae columnas que la pantalla no usa: más ancho de banda, más
 * riesgo de exponer campos sensibles y cero pistas de qué necesita cada vista.
 * La regla no exige migrar todo hoy: congela el número actual (ratchet) para
 * que ningún archivo nuevo agregue lecturas comodín. Al reemplazar uno por
 * columnas explícitas, baja el tope aquí.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sync as globSync } from "fast-glob";

/**
 * Ola 5 · RN-1 — holgura documentada: el tope es la deuda congelada + 10.
 * Sin holgura, cualquier PR inocente rompía CI. Plan: bajar el tope cada
 * trimestre a `deuda_actual + 10` conforme se migran archivos.
 */
const DEUDA_CONGELADA = 50;
const HOLGURA = 10;
const MAX_SELECT_STAR = DEUDA_CONGELADA + HOLGURA;

function contarSelectStar(): { total: number; porArchivo: Record<string, number> } {
  const archivos = globSync("src/**/*.{ts,tsx}", {
    ignore: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx", "src/test/**"],
  });
  const porArchivo: Record<string, number> = {};
  let total = 0;
  for (const archivo of archivos) {
    const ocurrencias = readFileSync(archivo, "utf8").match(/select\("\*/g)?.length ?? 0;
    if (ocurrencias > 0) {
      porArchivo[archivo] = ocurrencias;
      total += ocurrencias;
    }
  }
  return { total, porArchivo };
}

describe("arquitectura · ratchet de select(\"*\")", () => {
  it(`no supera ${MAX_SELECT_STAR} lecturas comodín en código de producción`, () => {
    const { total, porArchivo } = contarSelectStar();
    expect(
      total,
      `Se detectaron ${total} usos de select("*") (tope ${MAX_SELECT_STAR}). ` +
        `Usa columnas explícitas (p. ej. un \`services/columns.ts\` del feature). Detalle: ` +
        JSON.stringify(porArchivo, null, 2),
    ).toBeLessThanOrEqual(MAX_SELECT_STAR);
  });

  it("mantiene el tope sincronizado (si bajaste ocurrencias, baja el tope)", () => {
    const { total } = contarSelectStar();
    expect(
      DEUDA_CONGELADA - total,
      "Hay margen de sobra en el ratchet: ajusta DEUDA_CONGELADA al conteo real.",
    ).toBeLessThanOrEqual(HOLGURA);
  });
});
