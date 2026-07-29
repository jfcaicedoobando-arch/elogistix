/**
 * Cálculos puros de KPIs financieros de un embarque (totales, utilidad, margen).
 * Extraído de useEmbarqueFinancials para hacerlo testeable sin React.
 *
 * FIX C6: la conversión pasa por el canon único. Un concepto en USD/EUR sin
 * tipo de cambio confiable ya NO se suma como si fuera MXN: se excluye y se
 * reporta en `montosSinTipoCambio` para que la UI pueda advertirlo.
 */
import { calcularUtilidad, calcularMargen, type Moneda } from "@/lib/financial/financialUtils";
import { sumarEnMxn } from "@/lib/financial/convertir";

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
  /** Conceptos (venta + costo) excluidos por falta de tipo de cambio confiable. */
  montosSinTipoCambio: number;
}

function totalEnMxn<T>(
  items: T[],
  get: (i: T) => { monto: number; moneda: Moneda },
  tcUsd: number,
  tcEur: number,
): { total: number; sinTipoCambio: number } {
  const res = sumarEnMxn(items, (item) => {
    const { monto, moneda } = get(item);
    return { monto: Number(monto), moneda };
  }, { usd: tcUsd, eur: tcEur });
  return { total: res.total, sinTipoCambio: res.sinTipoCambio };
}

export function computeEmbarqueKpis(
  conceptosVenta: ConceptoVentaKpi[],
  conceptosCosto: ConceptoCostoKpi[],
  tipoCambioUSD: number,
  tipoCambioEUR: number,
): EmbarqueKpis {
  const venta = totalEnMxn(conceptosVenta, (c) => ({ monto: c.total, moneda: c.moneda }), tipoCambioUSD, tipoCambioEUR);
  const costo = totalEnMxn(conceptosCosto, (c) => ({ monto: c.monto, moneda: c.moneda }), tipoCambioUSD, tipoCambioEUR);
  return {
    totalVenta: venta.total,
    totalCosto: costo.total,
    utilidad: calcularUtilidad(venta.total, costo.total),
    margen: calcularMargen(venta.total, costo.total),
    montosSinTipoCambio: venta.sinTipoCambio + costo.sinTipoCambio,
  };
}
