/**
 * Tipos y comparador de orden para la tabla de TabVsReal.
 */
import type { FilaVsReal } from "@/features/presupuesto/services";

export type SortKey = "categoria" | "presupuesto" | "real" | "variacion" | "cumplimiento";
export type SortDir = "asc" | "desc";

export function ordenarFilas(filas: FilaVsReal[], key: SortKey, dir: SortDir): FilaVsReal[] {
  const sign = dir === "asc" ? 1 : -1;
  const cmp: Record<SortKey, (a: FilaVsReal, b: FilaVsReal) => number> = {
    categoria: (a, b) => a.categoria_nombre.localeCompare(b.categoria_nombre, "es-MX"),
    presupuesto: (a, b) => a.presupuesto_mxn - b.presupuesto_mxn,
    real: (a, b) => a.real_mxn - b.real_mxn,
    variacion: (a, b) => a.variacion_mxn - b.variacion_mxn,
    cumplimiento: (a, b) => a.cumplimiento_pct - b.cumplimiento_pct,
  };
  return [...filas].sort((a, b) => cmp[key](a, b) * sign);
}
