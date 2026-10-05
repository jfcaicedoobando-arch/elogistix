/**
 * Re-export de tipos P&L (ahora viven en `@/types/cotizacion`) más helper UI.
 * Tipos en este archivo se preservan como re-export para no romper consumidores legacy.
 */
import { calcularUtilidad, calcularMargen, sumarSubtotales, sumarMontos } from "@/lib/financial/financialUtils";

export type { FilaCostoLocal, FilaCostoDetalle } from "@/features/cotizacion/types";

/** Helper compartido para calcular totales P&L a partir de filas heterogéneas. */
export function calcTotalsPL(rows: { cantidad: number; costo: number; venta: number }[]) {
  const totalCosto = sumarSubtotales(rows, (r) => ({ cantidad: r.cantidad, precioUnitario: r.costo }));
  // La venta ya es el total capturado: no despejar y redondear un unitario intermedio.
  const totalVenta = sumarMontos(rows.map((r) => r.venta));
  return { totalCosto, totalVenta, profit: calcularUtilidad(totalVenta, totalCosto), porcentaje: calcularMargen(totalVenta, totalCosto) };
}

/**
 * Q-10 (Ola 4): una fila de costo es válida para el wizard aunque no tenga
 * `clave_sat` si se marcó explícitamente como "concepto libre" — la clave
 * se pedirá después en el paso de facturación (`concepto_libre: true`).
 * Filas legacy (sin `clave_sat` y sin el flag) siguen viéndose como
 * "pendientes" (warning) en `ProductoServicioSelect`.
 */
export function esFilaCostoValida(fila: { concepto: string; clave_sat?: string; concepto_libre?: boolean }): boolean {
  if (!fila.concepto?.trim()) return false;
  return Boolean(fila.clave_sat) || Boolean(fila.concepto_libre);
}
