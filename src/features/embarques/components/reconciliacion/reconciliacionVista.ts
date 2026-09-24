/** Helpers puros de vista para la tabla de reconciliación a 3 columnas. */
import type { FilaReconciliacion3C } from "@/lib/domain/versionadoCotizacion";

/** Sólo alerta/crítica: pendientes no tienen variación calculable. */
export function filtrarSoloVarianza(filas: FilaReconciliacion3C[]): FilaReconciliacion3C[] {
  return filas.filter((f) => f.clasificacion === "alerta" || f.clasificacion === "critica");
}

/** Clave de orden: pendientes sin clave numérica (van al final), nunca -100%. */
export function clavePctOrden(f: FilaReconciliacion3C, pct: number): number | undefined {
  return f.sin_factura || f.pendiente_tc ? undefined : pct;
}
