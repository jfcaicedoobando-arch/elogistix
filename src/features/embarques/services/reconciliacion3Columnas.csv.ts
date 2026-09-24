/** Exportación CSV de la reconciliación a 3 columnas. */
import { toCsv } from "@/lib/csv/serializeCsv";
import type { FilaReconciliacion3C } from "@/lib/domain/versionadoCotizacion";

/** P1-C: sólo filas comparables llevan % numérico; el resto, vacío + motivo. */
export function estatusFila3C(f: FilaReconciliacion3C): string {
  if (f.pendiente_tc) return "Pendiente de tipo de cambio";
  if (f.sin_factura) return "Sin factura";
  return f.clasificacion;
}

export function generarCsvReconciliacion3C(filas: FilaReconciliacion3C[]): string {
  return toCsv(
    ["Concepto", "Moneda", "Cotizado", "Refrescado", "Real", "Δ Cot vs Real (%)", "Δ Refr vs Real (%)", "Clasificación"],
    filas.map((f) => [
      f.concepto,
      f.moneda,
      String(f.cotizado),
      String(f.refrescado),
      String(f.real),
      f.sin_factura || f.pendiente_tc ? "" : f.delta_cot_vs_real.pct.toFixed(2),
      f.sin_factura || f.pendiente_tc ? "" : f.delta_refr_vs_real.pct.toFixed(2),
      estatusFila3C(f),
    ]),
  );
}
