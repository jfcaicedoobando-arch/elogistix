/**
 * Constructor único de la cinta de KPIs de documentos financieros
 * (facturas emitidas y recibidas). Estandariza etiquetas, tonos y pistas
 * para que ambas pantallas hablen el mismo idioma (estilo Odoo/QuickBooks).
 * Sólo formato: no calcula reglas de negocio.
 */
import { formatCurrency, formatDate } from "@/lib/formatters";
import { pluralizar } from "@/lib/format/pluralizar";

/** Métrica única de la cinta de KPIs de un documento financiero. */
export interface DocumentoKpi {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "destructive";
  hint?: string;
}

export interface DocumentoKpiInput {
  total: number;
  /** Importe ya cobrado (emitida) o pagado (recibida). */
  pagado: number;
  /** Importe pendiente del documento. */
  saldo: number;
  moneda: string;
  cancelada: boolean;
  fechaVencimiento?: string | null;
  diasCredito?: number | null;
  diasVencido?: number | null;
  /** "Cobrado" para facturas emitidas, "Pagado" para recibidas. */
  etiquetaPagado: "Cobrado" | "Pagado";
}

const UMBRAL_SALDO = 0.005;

export function buildKpisDocumento(input: DocumentoKpiInput): DocumentoKpi[] {
  const { moneda, cancelada } = input;
  const saldo = cancelada ? 0 : input.saldo;
  const pagado = cancelada ? 0 : input.pagado;
  const conSaldo = saldo > UMBRAL_SALDO;
  const diasVencido = input.diasVencido ?? 0;
  const vencida = conSaldo && diasVencido > 0;

  return [
    { label: "Total", value: formatCurrency(input.total, moneda) },
    {
      label: input.etiquetaPagado,
      value: formatCurrency(pagado, moneda),
      tone: !conSaldo && pagado > 0 ? "success" : "default",
    },
    {
      label: "Importe pendiente",
      value: formatCurrency(saldo, moneda),
      tone: vencida ? "destructive" : conSaldo ? "warning" : "default",
    },
    {
      label: "Vence el",
      value: input.fechaVencimiento ? formatDate(input.fechaVencimiento) : "—",
      tone: vencida ? "destructive" : "default",
      hint: vencida
        ? `${pluralizar(diasVencido, "día")} de atraso`
        : `${pluralizar(input.diasCredito ?? 0, "día")} de crédito`,
    },
  ];
}
