/**
 * Tipos compartidos para las tablas de costos internos P&L (Cotización).
 * Extraído de SeccionCostosInternosPLUnificado para evitar dependencias circulares
 * entre el componente padre y las subtablas (TablaCostosLocal/TablaCostosDetalle).
 */
import { calcularTotalesPL } from "@/lib/profitUtils";

export interface FilaCostoLocal {
  concepto: string;
  moneda: "USD" | "MXN";
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  precio_venta: number;
  unidad_medida: string;
  aplica_iva?: boolean;
  notas?: string;
}

export interface FilaCostoDetalle {
  concepto: string;
  moneda: "USD" | "MXN";
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  venta: number;
  aplica_iva?: boolean;
  notas?: string;
}

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
