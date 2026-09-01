/**
 * Ola 3 · O3.15b — una sola vía para fecha+hora en `src/features`.
 *
 * El canon de presentación vive en `src/lib/formatters/dates.ts`
 * (`formatFechaDia`, `formatFechaHora`, `formatFechaHoraCorta`, …). Llamar
 * directo a `format(...)` de `date-fns` dentro de una feature reintroduce
 * fallbacks y locales ad hoc.
 *
 * No se exige migrar toda la deuda histórica hoy (algunos usos son
 * serialización ISO para el backend, no presentación): se congela el
 * conteo con holgura (ratchet), igual que `formatfechaes-deprecado.test.ts`.
 * Código nuevo no debe agregar más usos de `format(` importado de
 * `date-fns` — usa los helpers de `@/lib/formatters` o `@/lib/date`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sync as globSync } from "fast-glob";

const DEUDA_CONGELADA = 11; // v13.823.7: `calcularPulso` pasó a `diaNegocio` (hoyMx).
const HOLGURA = 4;
const MAX_USOS = DEUDA_CONGELADA + HOLGURA;

function archivosConDateFnsFormat(): string[] {
  return globSync("src/features/**/*.{ts,tsx}", {
    ignore: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"],
  }).filter((f) => /from ["']date-fns["']/.test(readFileSync(f, "utf8")));
}

function contarUsos(): { total: number; porArchivo: Record<string, number> } {
  const porArchivo: Record<string, number> = {};
  let total = 0;
  for (const archivo of archivosConDateFnsFormat()) {
    const src = readFileSync(archivo, "utf8");
    const n = src.match(/\bformat\(/g)?.length ?? 0;
    if (n > 0) {
      porArchivo[archivo] = n;
      total += n;
    }
  }
  return { total, porArchivo };
}

describe("architecture — sin format() de date-fns en src/features (O3.15b)", () => {
  it(`no crece por encima de ${MAX_USOS} usos`, () => {
    const { total, porArchivo } = contarUsos();
    expect(
      total,
      "Usa formatFechaHora/formatFechaHoraCorta/formatFechaDia de @/lib/formatters " +
        "en lugar de format() de date-fns dentro de src/features. Usos actuales:\n" +
        JSON.stringify(porArchivo, null, 2),
    ).toBeLessThanOrEqual(MAX_USOS);
  });

  it("date-fns format en features: si bajaste ocurrencias, baja el tope", () => {
    const { total } = contarUsos();
    expect(
      total,
      `Quedan ${total} usos y el tope es ${MAX_USOS}: baja DEUDA_CONGELADA a la ` +
        "cuenta real para que el ratchet no permita reintroducir usos.",
    ).toBeGreaterThan(MAX_USOS - HOLGURA - 1);
  });
});
