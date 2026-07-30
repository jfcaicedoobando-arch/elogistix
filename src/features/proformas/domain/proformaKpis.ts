/**
 * KPIs del encabezado de una proforma. Mantiene la misma cinta que las
 * facturas emitidas y recibidas (Total · Subtotal · IVA · Crédito) para que
 * las tres pantallas se lean igual.
 */
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { DocumentoKpi } from "@/lib/domain/documentoKpis";
import type { calcularTotalesProforma } from "@/features/proformas/domain/proforma";

type Totales = ReturnType<typeof calcularTotalesProforma>;

export interface ProformaKpiInput {
  totales: Totales;
  diasCredito?: number | null;
  fechaEmision?: string | null;
  facturada: boolean;
}

export function buildKpisProforma(input: ProformaKpiInput): DocumentoKpi[] {
  const { totales } = input;
  const hayUsd = totales.subtotal_usd > 0;
  const hayMxn = totales.subtotal_mxn > 0;
  const moneda: "USD" | "MXN" = hayUsd ? "USD" : "MXN";
  const subtotal = hayUsd ? totales.subtotal_usd : totales.subtotal_mxn;
  const iva = hayUsd ? totales.iva_usd : totales.iva_mxn;
  const total = hayUsd ? totales.total_usd : totales.total_mxn;
  const hintMixto =
    hayUsd && hayMxn ? `+ ${formatCurrency(totales.total_mxn, "MXN")}` : undefined;

  return [
    { label: "Total", value: formatCurrency(total, moneda), hint: hintMixto },
    { label: "Subtotal", value: formatCurrency(subtotal, moneda) },
    { label: "IVA", value: formatCurrency(iva, moneda) },
    {
      label: "Crédito",
      value: `${input.diasCredito ?? 0} días`,
      tone: input.facturada ? "success" : "default",
      hint: input.fechaEmision ? `Emitida ${formatDate(input.fechaEmision)}` : undefined,
    },
  ];
}
