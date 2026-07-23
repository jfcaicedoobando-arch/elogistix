/**
 * Helpers para construir el payload del Recibo Electrónico de Pago (REP / Complemento de Pagos)
 * v13.91.0. Lógica pura para testeo aislado.
 *
 * Facturapi docs Complemento de Pagos:
 *   https://docs.facturapi.io/api/#tag/Invoices/operation/createInvoice (type: "P")
 */
import {
  buildPdfCustomSection,
  type ReferenciasEmbarque,
} from "../_shared/referenciasEmbarque.ts";
export type { ReferenciasEmbarque } from "../_shared/referenciasEmbarque.ts";


export interface PagoContext {
  // Receptor (mismo del CFDI original)
  receptor: {
    legal_name: string;
    tax_id: string;
    tax_system: string;
    address: { zip: string };
    email?: string | null;
  };
  // Datos del pago
  fecha_pago: string;       // ISO date (YYYY-MM-DD) o ISO timestamp
  forma_pago: string;       // SAT c_FormaPago: 01, 02, 03, 04, 99...
  moneda: string;           // MXN, USD...
  tipo_cambio: number;      // 1 si MXN; tipo de cambio del pago si diferente a MXN
  monto: number;            // Monto del pago en la moneda del pago
  numero_operacion?: string | null;
  // Documento relacionado (la factura original)
  documento_relacionado: {
    uuid: string;                  // UUID del CFDI original
    folio?: string | null;
    serie?: string | null;
    moneda_dr: string;             // Moneda de la factura original
    tipo_cambio_dr: number;        // Tipo de cambio de la factura original (1 si moneda_dr == moneda)
    num_parcialidad: number;       // 1, 2, 3...
    imp_saldo_ant: number;         // Saldo antes de este pago, en moneda_dr
    imp_pagado: number;            // Importe que este pago abona en moneda_dr
    imp_saldo_insoluto: number;    // Saldo después de este pago
    metodo_pago: "PPD";            // siempre PPD para REP
    /** Tasa principal (0.16, 0). Se asume IVA tasa única por simplicidad. */
    tasa_iva: number;
  };
  serie?: string | null;           // Serie del REP (si se usa serie distinta a las facturas)
  /** v13.208.0 — Expediente y BLs del embarque asociado. */
  referencias?: ReferenciasEmbarque | null;
}

export interface FacturapiRepPayload {
  type: "P";
  serie?: string;
  /** v13.208.0 — Bloque HTML libre que FacturAPI imprime al pie del PDF. */
  pdf_custom_section?: string;
  customer: {
    legal_name: string;
    tax_id: string;
    tax_system: string;
    address: { zip: string };
    email?: string;
  };
  complements: Array<{
    type: "pago";
    data: Array<{
      payment_form: string;
      currency: string;
      exchange?: number;
      amount: number;
      date: string;
      operation_number?: string;
      related_documents: Array<{
        uuid: string;
        folio?: string;
        series?: string;
        currency: string;
        exchange?: number;
        installment: number;
        last_balance: number;
        amount: number;
        taxes?: Array<{ type: "IVA"; rate: number; factor: "Tasa"; withholding: false }>;
      }>;
    }>;
  }>;
}

export interface RepValidationIssue { field: string; message: string }

const RFC_RX = /^([A-ZÑ&]{3,4})\d{6}(?:[A-Z\d]{2}[A\d0-9])$/i;

function isValidRfc(rfc: string | null | undefined): boolean {
  if (!rfc) return false;
  const v = rfc.trim().toUpperCase();
  if (v === "XAXX010101000" || v === "XEXX010101000") return true;
  return RFC_RX.test(v);
}

function isValidZip(zip: string | null | undefined): boolean {
  return !!zip && /^\d{5}$/.test(zip.trim());
}

const FORMA_PAGO_MAP: Record<string, string> = {
  transferencia: "03",
  transfer: "03",
  cheque: "02",
  efectivo: "01",
  tarjeta: "04",
  "tarjeta de crédito": "04",
  "tarjeta de credito": "04",
  "tarjeta de débito": "28",
  "tarjeta de debito": "28",
  otro: "99",
};

export function normalizarFormaPago(formaPago: string | null | undefined): string {
  if (!formaPago) return "99";
  const v = formaPago.trim();
  if (/^\d{2}$/.test(v)) return v;
  const key = v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return FORMA_PAGO_MAP[key] ?? "99";
}

export function validateRepContext(ctx: PagoContext): RepValidationIssue[] {
  const issues: RepValidationIssue[] = [];
  if (!isValidRfc(ctx.receptor.tax_id)) issues.push({ field: "rfc", message: "RFC del receptor inválido" });
  if (!isValidZip(ctx.receptor.address.zip)) issues.push({ field: "codigo_postal", message: "Código postal del receptor requerido (5 dígitos)" });
  if (!ctx.receptor.tax_system) issues.push({ field: "regimen_fiscal", message: "Régimen fiscal del receptor requerido" });
  if (!normalizarFormaPago(ctx.forma_pago)) issues.push({ field: "forma_pago", message: "Forma de pago SAT requerida" });
  if (!ctx.fecha_pago) issues.push({ field: "fecha_pago", message: "Fecha de pago requerida" });
  if (!(ctx.monto > 0)) issues.push({ field: "monto", message: "Monto del pago debe ser mayor a 0" });
  if (ctx.moneda !== "MXN" && !(ctx.tipo_cambio > 0)) {
    issues.push({ field: "tipo_cambio", message: "Tipo de cambio requerido cuando moneda ≠ MXN" });
  }
  if (!ctx.documento_relacionado.uuid) issues.push({ field: "documento.uuid", message: "La factura original debe estar timbrada (UUID requerido)" });
  if (!(ctx.documento_relacionado.num_parcialidad >= 1)) issues.push({ field: "documento.num_parcialidad", message: "Número de parcialidad inválido" });
  if (!(ctx.documento_relacionado.imp_pagado > 0)) issues.push({ field: "documento.imp_pagado", message: "Importe pagado inválido" });
  if (ctx.documento_relacionado.imp_saldo_ant < ctx.documento_relacionado.imp_pagado - 0.01) {
    issues.push({ field: "documento.imp_saldo_ant", message: "Saldo anterior menor al importe pagado" });
  }
  return issues;
}

/**
 * Construye el payload Facturapi para timbrar el REP.
 * Si moneda del pago == moneda del documento, no enviamos `exchange` en el doc relacionado.
 */
export function buildRepPayload(ctx: PagoContext): FacturapiRepPayload {
  const dr = ctx.documento_relacionado;
  const sameCurrency = ctx.moneda === dr.moneda_dr;

  const payload: FacturapiRepPayload = {
    type: "P",
    customer: {
      legal_name: ctx.receptor.legal_name,
      tax_id: ctx.receptor.tax_id.trim().toUpperCase(),
      tax_system: ctx.receptor.tax_system,
      address: { zip: ctx.receptor.address.zip.trim() },
    },
    complements: [
      {
        type: "pago",
        data: [
          {
            payment_form: normalizarFormaPago(ctx.forma_pago),
            currency: ctx.moneda,
            amount: round2(ctx.monto),
            date: ctx.fecha_pago,
            related_documents: [
              {
                uuid: dr.uuid,
                currency: dr.moneda_dr,
                installment: dr.num_parcialidad,
                last_balance: round2(dr.imp_saldo_ant),
                amount: round2(dr.imp_pagado),
                taxes: dr.tasa_iva > 0
                  ? [{ type: "IVA", rate: dr.tasa_iva, factor: "Tasa", withholding: false, base: round2(dr.imp_pagado) }]
                  : undefined,
              },
            ],
          },
        ],
      },
    ],
  };

  if (ctx.serie) payload.serie = ctx.serie;
  if (ctx.receptor.email) payload.customer.email = ctx.receptor.email;
  if (ctx.numero_operacion) payload.complements[0].data[0].operation_number = ctx.numero_operacion;
  if (ctx.moneda !== "MXN" && ctx.tipo_cambio > 0) {
    payload.complements[0].data[0].exchange = ctx.tipo_cambio;
  }

  const rdoc = payload.complements[0].data[0].related_documents[0];
  if (dr.folio) rdoc.folio = dr.folio;
  if (dr.serie) rdoc.series = dr.serie;
  // exchange en el documento relacionado: relación moneda_dr → moneda del pago
  if (!sameCurrency && dr.tipo_cambio_dr > 0) {
    rdoc.exchange = dr.tipo_cambio_dr;
  }

  // v13.208.0 — Bloque "Referencias del embarque" al pie del PDF.
  const pdfSection = buildPdfCustomSection(ctx.referencias);
  if (pdfSection) payload.pdf_custom_section = pdfSection;

  return payload;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
