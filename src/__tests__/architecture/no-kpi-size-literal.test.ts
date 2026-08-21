/**
 * Ola 3 · O3.2 — candado `no-kpi-size-literal`.
 *
 * Las cifras destacadas (KPIs, totales, contadores grandes) usan el token
 * tipográfico `text-kpi` (clamp responsivo, peso y altura de línea del design
 * system), no combinaciones manuales de `text-lg/xl/2xl` + `font-bold` +
 * `tabular-nums`. Se migraron todos los usos históricos; esta guardia bloquea
 * reintroducciones. Si aparece un caso legítimo, primero discute extender el
 * token en `tailwind.config.ts`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sync as globSync } from "fast-glob";

/** Línea con tamaño literal grande + peso fuerte + cifras alineadas = KPI artesanal. */
const KPI_LITERAL =
  /(text-(lg|xl|2xl)\b[^\n]*\bfont-(semi)?bold\b|\bfont-(semi)?bold\b[^\n]*\btext-(lg|xl|2xl)\b)[^\n]*\btabular-nums\b|\btabular-nums\b[^\n]*\btext-(lg|xl|2xl)\b[^\n]*\bfont-(semi)?bold\b|\btabular-nums\b[^\n]*\bfont-(semi)?bold\b[^\n]*\btext-(lg|xl|2xl)\b/g;

function archivosConKpiLiteral(): Record<string, number> {
  const archivos = globSync("src/**/*.tsx", {
    ignore: ["**/__tests__/**", "**/*.test.tsx", "src/test/**"],
  });
  const resultado: Record<string, number> = {};
  for (const archivo of archivos) {
    const ocurrencias = readFileSync(archivo, "utf8").match(KPI_LITERAL)?.length ?? 0;
    if (ocurrencias > 0) resultado[archivo] = ocurrencias;
  }
  return resultado;
}

describe("arquitectura · no-kpi-size-literal", () => {
  it("ninguna cifra destacada usa text-lg/xl/2xl + font-bold + tabular-nums (usa text-kpi)", () => {
    const infractores = archivosConKpiLiteral();
    expect(
      infractores,
      `Usa el token text-kpi para cifras destacadas en lugar de text-lg/xl/2xl + font-bold + tabular-nums. Archivos: ` +
        JSON.stringify(infractores, null, 2),
    ).toEqual({});
  });
});
