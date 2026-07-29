/**
 * Re-export de tipos P&L (ahora viven en `@/types/cotizacion`) más helper UI.
 * Tipos en este archivo se preservan como re-export para no romper consumidores legacy.
 */
import { calcularTotalesPL } from "@/lib/financial/profitUtils";

export type { FilaCostoLocal, FilaCostoDetalle } from "@/features/cotizacion/types";

/** Helper compartido para calcular totales P&L a partir de filas heterogéneas. */
export function calcTotalsPL(rows: { cantidad: number; costo: number; venta: number }[]) {
  return calcularTotalesPL(
    rows.map(r => ({
      cantidad: r.cantidad,
      costo_unitario: r.costo,
      precio_venta: r.venta / (r.cantidad || 1),
    })),
  );
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
