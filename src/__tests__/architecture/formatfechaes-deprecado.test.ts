/**
 * Ola 5 · V-14 — `formatFechaEs` queda deprecado.
 *
 * El canon es `formatFechaDia` (fallback "—") y `formatFechaHora`. No se exige
 * migrar los 56 call-sites históricos hoy: se congela el conteo con holgura
 * documentada (RN-1) para que el código nuevo use el canon. Al migrar
 * archivos, baja `DEUDA_CONGELADA`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sync as globSync } from "fast-glob";

const DEUDA_CONGELADA = 56;
const HOLGURA = 10;
const MAX_FORMAT_FECHA_ES = DEUDA_CONGELADA + HOLGURA;

function contarUsos(): { total: number; porArchivo: Record<string, number> } {
  const archivos = globSync("src/**/*.{ts,tsx}", {
    ignore: [
      "src/lib/**",
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "src/test/**",
    ],
  });
  const porArchivo: Record<string, number> = {};
  let total = 0;
  for (const archivo of archivos) {
    const n = readFileSync(archivo, "utf8").match(/\bformatFechaEs\b/g)?.length ?? 0;
    if (n > 0) {
      porArchivo[archivo] = n;
      total += n;
    }
  }
  return { total, porArchivo };
}

describe("arquitectura · formatFechaEs deprecado", () => {
  it(`no crece por encima de ${MAX_FORMAT_FECHA_ES} usos fuera de src/lib`, () => {
    const { total, porArchivo } = contarUsos();
    expect(
      total,
      `Usa formatFechaDia/formatFechaHora en código nuevo. Usos actuales: ${JSON.stringify(porArchivo, null, 2)}`,
    ).toBeLessThanOrEqual(MAX_FORMAT_FECHA_ES);
  });

  it("mantiene la marca @deprecated en el canon de fechas", () => {
    const src = readFileSync("src/lib/formatters/dates.ts", "utf8");
    const antes = src.slice(0, src.indexOf("export function formatFechaEs"));
    expect(antes).toContain("@deprecated");
  });
});
