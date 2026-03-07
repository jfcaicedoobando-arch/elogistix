import { Badge } from "@/components/ui/badge";
import { calcularUtilidad, calcularMargen } from "@/lib/financialUtils";

/** Muestra un badge de porcentaje de profit coloreado según el nivel */
export function ProfitBadge({ porcentaje }: { porcentaje: number }) {
  if (porcentaje > 15) return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{porcentaje.toFixed(1)}%</Badge>;
  if (porcentaje > 0) return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{porcentaje.toFixed(1)}%</Badge>;
  if (porcentaje < 0) return <Badge className="bg-red-100 text-red-700 border-red-200">{porcentaje.toFixed(1)}%</Badge>;
  return <Badge variant="secondary">0%</Badge>;
}

/** Resultado de cálculo de totales P&L */
export interface TotalesPL {
  totalCosto: number;
  totalVenta: number;
  profit: number;
  porcentaje: number;
}

/** Calcula totales de P&L para un conjunto de filas con cantidad, costo_unitario y precio_venta */
export function calcularTotalesPL(filas: { cantidad: number; costo_unitario: number; precio_venta: number }[]): TotalesPL {
  const totalCosto = filas.reduce((s, f) => s + f.cantidad * f.costo_unitario, 0);
  const totalVenta = filas.reduce((s, f) => s + f.cantidad * f.precio_venta, 0);
  const profit = calcularUtilidad(totalVenta, totalCosto);
  const porcentaje = calcularMargen(totalVenta, totalCosto);
  return { totalCosto, totalVenta, profit, porcentaje };
}

/** Badge global de rentabilidad basado en porcentajes USD y MXN */
export function RentabilidadGlobalBadge({
  porcentajeUSD, porcentajeMXN, tieneUSD, tieneMXN,
}: {
  porcentajeUSD: number; porcentajeMXN: number; tieneUSD: boolean; tieneMXN: boolean;
}) {
  const usdSaludable = !tieneUSD || porcentajeUSD > 15;
  const mxnSaludable = !tieneMXN || porcentajeMXN > 10;
  if (usdSaludable && mxnSaludable && (tieneUSD || tieneMXN))
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-sm">Rentabilidad Saludable</Badge>;
  const usdNegativo = tieneUSD && porcentajeUSD < 0;
  const mxnNegativo = tieneMXN && porcentajeMXN < 0;
  if (usdNegativo || mxnNegativo)
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-sm">Rentabilidad Negativa</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-sm">Rentabilidad Baja</Badge>;
}
