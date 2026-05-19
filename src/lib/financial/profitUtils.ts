import currency from "currency.js";
import { calcularUtilidad, calcularMargen } from "@/lib/financial/financialUtils";

/** Resultado de cálculo de totales P&L */
export interface TotalesPL {
  totalCosto: number;
  totalVenta: number;
  profit: number;
  porcentaje: number;
}

/**
 * Calcula totales de P&L acumulando con currency.js para evitar drift
 * de punto flotante al sumar muchas filas. Firma intacta.
 */
export function calcularTotalesPL(filas: { cantidad: number; costo_unitario: number; precio_venta: number }[]): TotalesPL {
  const totalCosto: number = filas
    .reduce((acc, f) => acc.add(currency(f.costo_unitario, { precision: 2 }).multiply(f.cantidad)), currency(0, { precision: 2 }))
    .value;
  const totalVenta: number = filas
    .reduce((acc, f) => acc.add(currency(f.precio_venta, { precision: 2 }).multiply(f.cantidad)), currency(0, { precision: 2 }))
    .value;
  const profit: number = calcularUtilidad(totalVenta, totalCosto);
  const porcentaje: number = calcularMargen(totalVenta, totalCosto);
  return { totalCosto, totalVenta, profit, porcentaje };
}
