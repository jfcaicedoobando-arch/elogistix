/**
 * Cálculos puros de KPIs financieros de un embarque (totales, utilidad, margen).
 * Extraído de useEmbarqueFinancials para hacerlo testeable sin React.
 */
import { convertirAMXN, calcularUtilidad, calcularMargen, type Moneda } from "@/lib/financial/financialUtils";

export interface ConceptoVentaKpi {
  total: number;
  moneda: Moneda;
}

export interface ConceptoCostoKpi {
  monto: number;
  moneda: Moneda;
}

export interface EmbarqueKpis {
  totalVenta: number;
  totalCosto: number;
  utilidad: number;
  margen: number;
}

function totalEnMxn<T>(items: T[], get: (i: T) => { monto: number; moneda: Moneda }, tcUsd: number, tcEur: number): number {
  return items.reduce((sum, item) => {
    const { monto, moneda } = get(item);
    return sum + convertirAMXN(Number(monto), moneda, tcUsd, tcEur);
  }, 0);
}

export function computeEmbarqueKpis(
  conceptosVenta: ConceptoVentaKpi[],
  conceptosCosto: ConceptoCostoKpi[],
  tipoCambioUSD: number,
  tipoCambioEUR: number,
): EmbarqueKpis {
  const totalVenta = totalEnMxn(conceptosVenta, (c) => ({ monto: c.total, moneda: c.moneda }), tipoCambioUSD, tipoCambioEUR);
  const totalCosto = totalEnMxn(conceptosCosto, (c) => ({ monto: c.monto, moneda: c.moneda }), tipoCambioUSD, tipoCambioEUR);
  return {
    totalVenta,
    totalCosto,
    utilidad: calcularUtilidad(totalVenta, totalCosto),
    margen: calcularMargen(totalVenta, totalCosto),
  };
}
