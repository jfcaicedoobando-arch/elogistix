/**
 * Ola 3 · O3.10 — candado de `Loader2` manual dentro de `<Button>`.
 *
 * El componente `Button` (ver `src/components/ui/button.tsx`) ya acepta la
 * prop `loading` para mostrar el spinner y deshabilitar el control: no hace
 * falta que cada consumidor arme `<Loader2 className="... animate-spin" />`
 * a mano. Este test evita que se reintroduzca ese patrón.
 *
 * Excepción documentada (ver comentario en `button.tsx`): los botones de
 * "refrescar tipo de cambio" cuyo ícono en reposo es `RefreshCw`/`RefreshCcw`
 * siguen alternando manualmente entre ese ícono y `Loader2`, porque `loading`
 * solo tiene sentido para reemplazar el ícono normal del botón, no para
 * alternar entre dos íconos distintos según el estado.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sync as globSync } from "fast-glob";

const ARCHIVOS_EXCEPTUADOS = new Set([
  "src/features/cxp/components/FacturaProveedorFormFields.moneda.tsx",
  "src/features/facturacion/components/FacturaManualDatosFiscales.tsx",
]);

/**
 * Ratchet igual al de `no-tofixed-jsx-ratchet.test.ts`: tras la migración de
 * O3.10 la deuda real es 0 (solo quedan las dos excepciones documentadas,
 * excluidas explícitamente). La holgura es mínima porque no debería volver a
 * aparecer este patrón.
 */
const DEUDA_CONGELADA = 0;
const HOLGURA = 2;
const MAX_LOADER2_EN_BUTTON = DEUDA_CONGELADA + HOLGURA;

function contarLoader2EnButton(): { total: number; porArchivo: Record<string, number> } {
  const archivos = globSync("src/**/*.tsx", {
    ignore: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx", "src/test/**"],
  });
  const porArchivo: Record<string, number> = {};
  let total = 0;
  for (const archivo of archivos) {
    if (ARCHIVOS_EXCEPTUADOS.has(archivo)) continue;
    const contenido = readFileSync(archivo, "utf8");
    const bloques = contenido.match(/<Button\b[\s\S]*?<\/Button>/g) ?? [];
    const ocurrencias = bloques.filter((bloque) => bloque.includes("Loader2")).length;
    if (ocurrencias > 0) {
      porArchivo[archivo] = ocurrencias;
      total += ocurrencias;
    }
  }
  return { total, porArchivo };
}

describe("arquitectura · sin Loader2 manual dentro de <Button>", () => {
  it(`no supera ${MAX_LOADER2_EN_BUTTON} usos de Loader2 dentro de <Button>`, () => {
    const { total, porArchivo } = contarLoader2EnButton();
    expect(
      total,
      `Se detectaron ${total} <Button> con Loader2 manual (tope ${MAX_LOADER2_EN_BUTTON}). ` +
        `Usa la prop \`loading\` de @/components/ui/button en vez de armar el spinner a mano. Detalle: ` +
        JSON.stringify(porArchivo, null, 2),
    ).toBeLessThanOrEqual(MAX_LOADER2_EN_BUTTON);
  });

  it("mantiene el tope sincronizado (si migraste archivos, baja el tope)", () => {
    const { total } = contarLoader2EnButton();
    expect(
      DEUDA_CONGELADA - total,
      "Hay margen de sobra en el ratchet: ajusta DEUDA_CONGELADA al conteo real.",
    ).toBeLessThanOrEqual(HOLGURA);
  });
});
