/**
 * Cotizaciones — derivación de `subtotal` + `moneda` desde los conceptos de venta.
 *
 * Extraído de `wizard.ts` (Power-of-10 #4: archivos ≤ 200 líneas).
 */
import { ReglaNegocioError } from "@/lib/errors/reglaNegocio";
import { tcValido } from "@/lib/financial/tcValido";
import { roundMoney } from "@/lib/financial/financialUtils";

/**
 * Mensaje único del bloqueo por cotización mixta (P1-A, 13.823.70).
 * 13.823.281: el texto explica la acción REAL disponible (capturar el TC de la
 * cotización en el paso 3, o unificar la moneda). Antes pedía un tipo de cambio
 * que ninguna pantalla permitía capturar.
 */
export const MSG_COTIZACION_MIXTA =
  "La cotización tiene conceptos en USD y en MXN. Captura el tipo de cambio de la cotización en el paso 3 " +
  "(botón «Traer TC DOF de hoy») para poder expresar el total del encabezado en una sola moneda, " +
  "o deja todos los conceptos en la misma moneda.";

/**
 * W-01 (QA r2): `subtotal` y `moneda` se derivan de los conceptos de venta.
 *
 * P1-A (13.823.70): en cotizaciones mixtas ya NO se elige la "bolsa mayor"
 * comparando USD contra MXN nominalmente.
 *
 * 13.823.281: la cotización ya puede guardar su propio TC USD/MXN
 * (`cotizaciones.tipo_cambio_usd`). Cuando existe, la mezcla se convierte
 * SÓLO para el subtotal del encabezado: los conceptos conservan su moneda e
 * importe originales. Sin TC se sigue fallando cerrado.
 *
 * A1/A7 (13.823.159): con venta en cero la moneda se toma del `monedaFallback`
 * canónico del vínculo y, sin él, de los propios renglones.
 */
export function derivarSubtotalMoneda(
  conceptosVenta: Record<string, unknown>[],
  monedaFallback?: string | null,
  tipoCambioUsd?: number | null,
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
  if (usd > 0 && mxn > 0) return mezclaConTipoCambio(usd, mxn, monedaFallback, tipoCambioUsd);
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

/**
 * Cotización híbrida: se expresa el encabezado en UNA moneda con el TC
 * congelado. La moneda objetivo es la del vínculo CRM si existe; si no, la
 * bolsa mayor ya convertida (comparación válida, no nominal).
 */
function mezclaConTipoCambio(
  usd: number,
  mxn: number,
  monedaFallback?: string | null,
  tipoCambioUsd?: number | null,
): { subtotal: number; moneda: "USD" | "MXN" } {
  const tc = tcValido(tipoCambioUsd);
  if (!tc) throw new ReglaNegocioError(MSG_COTIZACION_MIXTA);
  const objetivo: "USD" | "MXN" =
    monedaFallback === "MXN" || monedaFallback === "USD"
      ? monedaFallback
      : (usd * tc >= mxn ? "USD" : "MXN");
  const subtotal = objetivo === "MXN" ? mxn + usd * tc : usd + mxn / tc;
  return { subtotal: roundMoney(subtotal), moneda: objetivo };
}
