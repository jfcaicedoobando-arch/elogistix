/**
 * Subtotales por moneda de una cotización.
 *
 * Las columnas `subtotal` / `moneda` de `cotizaciones` guardan UN solo monto
 * y UNA sola moneda; en cotizaciones mixtas (conceptos en USD y en MXN) el
 * listado mostraba sólo una parte del importe. Este helper deriva el subtotal
 * real por moneda desde `conceptos_venta`, con fallback a las columnas planas
 * cuando no hay conceptos (borradores / cotizaciones sin desglose).
 */
import { parseConceptos } from "@/lib/domain/cotizacionDetalle";
import { sumarSubtotales } from "@/lib/financial/financialUtils";
import { aMxn } from "@/lib/financial/convertir";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";

export interface SubtotalMoneda {
  moneda: string;
  monto: number;
}

/** Orden de presentación estable: USD, luego EUR, luego MXN. */
const ORDEN_MONEDAS = ["USD", "EUR", "MXN"] as const;

const getter = (c: ConceptoVentaCotizacion) => ({
  cantidad: c.cantidad,
  precioUnitario: c.precio_unitario,
});

export function subtotalesPorMoneda(
  conceptosRaw: unknown,
  subtotalFallback: number | null | undefined,
  monedaFallback: string | null | undefined,
): SubtotalMoneda[] {
  const conceptos = parseConceptos(conceptosRaw);
  if (conceptos.length === 0) {
    if (typeof subtotalFallback !== "number") return [];
    return [{ moneda: monedaFallback ?? "MXN", monto: subtotalFallback }];
  }
  const resultado: SubtotalMoneda[] = [];
  for (const moneda of ORDEN_MONEDAS) {
    const filas = conceptos.filter((c) => c.moneda === moneda);
    if (filas.length === 0) continue;
    resultado.push({ moneda, monto: sumarSubtotales(filas, getter) });
  }
  if (resultado.length === 0 && typeof subtotalFallback === "number") {
    return [{ moneda: monedaFallback ?? "MXN", monto: subtotalFallback }];
  }
  return resultado;
}

/**
 * Equivalente total en MXN para ordenar el listado sin mezclar monedas.
 * Cada moneda usa SU PROPIO tipo de cambio (USD con `usdMxn`, EUR con
 * `eurMxn`); antes se aplicaba `usdMxn` a cualquier moneda distinta de MXN,
 * lo que convertía importes en EUR como si fueran USD.
 * @returns `null` si alguna moneda no es convertible con el TC disponible.
 */
export function normalizarSubtotalesMxn(
  subtotales: SubtotalMoneda[],
  usdMxn: number | null | undefined,
  eurMxn?: number | null | undefined,
): number | null {
  if (subtotales.length === 0) return null;
  let total = 0;
  for (const s of subtotales) {
    const tc = s.moneda === "EUR" ? eurMxn : usdMxn;
    const conversion = aMxn(s.monto, s.moneda, tc);
    if (!conversion.completo) return null;
    total += conversion.monto;
  }
  return total;
}
