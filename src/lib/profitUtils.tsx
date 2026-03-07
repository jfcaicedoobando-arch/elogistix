import { Badge } from "@/components/ui/badge";
import { calcularUtilidad, calcularMargen } from "@/lib/financialUtils";

/** Muestra un badge de porcentaje de profit coloreado según el nivel */
export function ProfitBadge({ porcentaje }: { porcentaje: number }): JSX.Element {
  if (porcentaje > 15) return <Badge className="bg-success/15 text-success border-success/30">{porcentaje.toFixed(1)}%</Badge>;
  if (porcentaje > 0) return <Badge className="bg-warning/15 text-warning border-warning/30">{porcentaje.toFixed(1)}%</Badge>;
  if (porcentaje < 0) return <Badge className="bg-destructive/15 text-destructive border-destructive/30">{porcentaje.toFixed(1)}%</Badge>;
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
  const totalCosto: number = filas.reduce((s, f) => s + f.cantidad * f.costo_unitario, 0);
  const totalVenta: number = filas.reduce((s, f) => s + f.cantidad * f.precio_venta, 0);
  const profit: number = calcularUtilidad(totalVenta, totalCosto);
  const porcentaje: number = calcularMargen(totalVenta, totalCosto);
  return { totalCosto, totalVenta, profit, porcentaje };
}

/** Badge global de rentabilidad basado en porcentajes USD y MXN */
export function RentabilidadGlobalBadge({
  porcentajeUSD, porcentajeMXN, tieneUSD, tieneMXN,
}: {
  porcentajeUSD: number; porcentajeMXN: number; tieneUSD: boolean; tieneMXN: boolean;
}): JSX.Element {
  const usdSaludable = !tieneUSD || porcentajeUSD > 15;
  const mxnSaludable = !tieneMXN || porcentajeMXN > 10;
  if (usdSaludable && mxnSaludable && (tieneUSD || tieneMXN))
    return <Badge className="bg-success/15 text-success border-success/30 text-sm">Rentabilidad Saludable</Badge>;
  const usdNegativo = tieneUSD && porcentajeUSD < 0;
  const mxnNegativo = tieneMXN && porcentajeMXN < 0;
  if (usdNegativo || mxnNegativo)
    return <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-sm">Rentabilidad Negativa</Badge>;
  return <Badge className="bg-warning/15 text-warning border-warning/30 text-sm">Rentabilidad Baja</Badge>;
}
