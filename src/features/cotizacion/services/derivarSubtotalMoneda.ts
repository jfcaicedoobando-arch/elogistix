/**
 * Cotizaciones — derivación de `subtotal` + `moneda` desde los conceptos de venta.
 *
 * Extraído de `wizard.ts` (Power-of-10 #4: archivos ≤ 200 líneas). Sin cambios
 * de comportamiento.
 */
import { ReglaNegocioError } from "@/lib/errors/reglaNegocio";

/** Mensaje único del bloqueo por cotización mixta (P1-A, 13.823.70). */
export const MSG_COTIZACION_MIXTA =
  "La cotización tiene conceptos en USD y en MXN. No existe un tipo de cambio registrado en la cotización para convertirlos, " +
  "por lo que el subtotal del encabezado quedaría incompleto. Captura los conceptos en una sola moneda (o registra el equivalente convertido) para continuar.";

/**
 * W-01 (QA r2): `subtotal` y `moneda` se derivan de los conceptos de venta.
 * Antes se persistía sólo `totalUSD`: una cotización sólo en pesos quedaba con
 * `subtotal = 0` y el detalle bloqueaba el envío por "sin importe".
 *
 * P1-A (13.823.70): en cotizaciones mixtas ya NO se elige la "bolsa mayor"
 * comparando USD contra MXN nominalmente. No existe tipo de cambio canónico en
 * `cotizaciones`, así que se falla cerrado en lugar de guardar un importe falso.
 *
 * A1/A7 (13.823.159): con venta en cero la moneda se toma del `monedaFallback`
 * canónico del vínculo y, sin él, de los propios renglones. No se convierte
 * ningún importe ni se relaja el rechazo de mezclas.
 */
export function derivarSubtotalMoneda(
  conceptosVenta: Record<string, unknown>[],
  monedaFallback?: string | null,
): { subtotal: number; moneda: "USD" | "MXN" } {
  let usd = 0;
  let mxn = 0;
  let filasUsd = 0;
  let filasMxn = 0;
  for (const c of conceptosVenta) {
    const total = Number(c?.total) || 0;
    if (c?.moneda === "MXN") { mxn += total; filasMxn += 1; }
    else { usd += total; filasUsd += 1; }
  }
  if (usd > 0 && mxn > 0) throw new ReglaNegocioError(MSG_COTIZACION_MIXTA);
  if (mxn > 0) return { subtotal: mxn, moneda: "MXN" };
  if (usd > 0) return { subtotal: usd, moneda: "USD" };
  // A1/A7: todo en cero. Sin ventas capturadas la divisa comercial es la
  // canónica del vínculo; un renglón prellenado en cero desde un costo interno
  // en otra moneda NO redenomina la cotización.
  if (monedaFallback === "MXN") return { subtotal: 0, moneda: "MXN" };
  if (monedaFallback === "USD") return { subtotal: 0, moneda: "USD" };
  // Sin vínculo/moneda canónica: preservar la divisa capturada en renglones.
  if (filasMxn > 0 && filasUsd === 0) return { subtotal: 0, moneda: "MXN" };
  return { subtotal: 0, moneda: "USD" };
}
