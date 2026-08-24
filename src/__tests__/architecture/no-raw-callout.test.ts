/**
 * Ola 3 · O3.8 — candado `no-raw-callout`.
 *
 * Los banners de estado ("callouts") usan el componente canónico
 * `Alert` de `@/components/ui/alert` con variante `info | success |
 * warning | destructive` (borde + fondo suave tintado + icono al tono).
 * Los banners artesanales con borde y fondo tintados a mano se migraron
 * parcialmente (los de mayor visibilidad); el resto queda congelado como deuda con
 * baseline ratchet, patrón DEUDA_CONGELADA + holgura igual que
 * `no-tofixed-jsx-ratchet`. Al migrar más banners, baja el tope aquí.
 *
 * Se excluye la definición canónica en `components/ui/alert.tsx`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sync as globSync } from "fast-glob";

/** className con borde semántico tintado + fondo suave = callout artesanal. */
const RAW_CALLOUT =
  /\bborder-(info|success|warning|destructive|primary|accent)\/[2345]0\b[^"'\n`]*\bbg-[a-z-]+\/(5|10)\b|\bbg-(info|success|warning|destructive|primary|accent)\/(5|10)\b[^"'\n`]*\bborder-[a-z-]+\/[2345]0\b/g;

/** Deuda restante tras la migración de los banners de mayor visibilidad.
 *  FIX-R3 (review_ola3 H2): baseline real verificado con este mismo regex —
 *  147 ocurrencias al 2026-08-31 (el baseline previo, 145, mentía por abajo). */
const DEUDA_CONGELADA = 147;
const HOLGURA = 10;
const MAX_RAW_CALLOUT = DEUDA_CONGELADA + HOLGURA;

function contarRawCallouts(): { total: number; porArchivo: Record<string, number> } {
  const archivos = globSync("src/**/*.tsx", {
    ignore: [
      "**/__tests__/**",
      "**/*.test.tsx",
      "src/test/**",
      // Definición canónica del callout.
      "src/components/ui/alert.tsx",
    ],
  });
  const porArchivo: Record<string, number> = {};
  let total = 0;
  for (const archivo of archivos) {
    const ocurrencias = readFileSync(archivo, "utf8").match(RAW_CALLOUT)?.length ?? 0;
    if (ocurrencias > 0) {
      porArchivo[archivo] = ocurrencias;
      total += ocurrencias;
    }
  }
  return { total, porArchivo };
}

describe("arquitectura · no-raw-callout", () => {
  it(`no supera ${MAX_RAW_CALLOUT} banners artesanales (usa Alert con variante)`, () => {
    const { total, porArchivo } = contarRawCallouts();
    expect(
      total,
      `Se detectaron ${total} callouts artesanales border-*/NN bg-*/5|10 (tope ${MAX_RAW_CALLOUT}). ` +
        `Usa <Alert variant="info|success|warning|destructive"> de @/components/ui/alert. Detalle: ` +
        JSON.stringify(
          Object.fromEntries(
            Object.entries(porArchivo)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10),
          ),
          null,
          2,
        ),
    ).toBeLessThanOrEqual(MAX_RAW_CALLOUT);
  });

  it("mantiene el tope sincronizado (si migraste banners, baja el tope)", () => {
    const { total } = contarRawCallouts();
    expect(
      // FIX-R3: chequeo bidireccional — antes era unilateral y no detectaba
      // un baseline POR DEBAJO del conteo real (145 vs 147).
      Math.abs(DEUDA_CONGELADA - total),
      "Hay margen de sobra en el ratchet: ajusta DEUDA_CONGELADA al conteo real.",
    ).toBeLessThanOrEqual(HOLGURA);
  });
});
