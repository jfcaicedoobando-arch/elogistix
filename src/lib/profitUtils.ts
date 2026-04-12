import { calcularUtilidad, calcularMargen } from "@/lib/financialUtils";

/** Resultado de cálculo de totales P&L */
export interface TotalesPL {
  totalCosto: number;
  totalVenta: number;
  profit: number;
  porcentaje: number;
}

/** Calcula totales de P&L para un conjunto de filas con cantidad, costo_unitario y precio_venta */
export function calcularTotalesPL(filas: { cantidad: number; costo_unitario: number; precio_venta: number }[]): TotalesPL {
  const totalCosto: number = filas.reduce((s, f) => s + f.cantidad * f.costo_unitario, 0);
  const totalVenta: number = filas.reduce((s, f) => s + f.cantidad * f.precio_venta, 0);
  const profit: number = calcularUtilidad(totalVenta, totalCosto);
  const porcentaje: number = calcularMargen(totalVenta, totalCosto);
  return { totalCosto, totalVenta, profit, porcentaje };
}
