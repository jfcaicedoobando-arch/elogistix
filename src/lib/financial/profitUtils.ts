import { calcularUtilidad, calcularMargen, sumarSubtotales } from "@/lib/financial/financialUtils";

/** Resultado de cálculo de totales P&L */
export interface TotalesPL {
  totalCosto: number;
  totalVenta: number;
  profit: number;
  porcentaje: number;
}

/**
 * Calcula totales de P&L redondeando cada subtotal una vez después de multiplicar para evitar drift
 * de punto flotante al sumar muchas filas. Firma intacta.
 */
export function calcularTotalesPL(filas: { cantidad: number; costo_unitario: number; precio_venta: number }[]): TotalesPL {
  const totalCosto = sumarSubtotales(filas, (f) => ({ cantidad: f.cantidad, precioUnitario: f.costo_unitario }));
  const totalVenta = sumarSubtotales(filas, (f) => ({ cantidad: f.cantidad, precioUnitario: f.precio_venta }));
  const profit: number = calcularUtilidad(totalVenta, totalCosto);
  const porcentaje: number = calcularMargen(totalVenta, totalCosto);
  return { totalCosto, totalVenta, profit, porcentaje };
}
