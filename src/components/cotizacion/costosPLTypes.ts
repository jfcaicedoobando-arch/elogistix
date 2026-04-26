/**
 * Re-export de tipos P&L (ahora viven en `@/types/cotizacionPL`) más helper UI.
 * Tipos en este archivo se preservan como re-export para no romper consumidores legacy.
 */
import { calcularTotalesPL } from "@/lib/financial/profitUtils";

export type { FilaCostoLocal, FilaCostoDetalle } from "@/types/cotizacionPL";

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
