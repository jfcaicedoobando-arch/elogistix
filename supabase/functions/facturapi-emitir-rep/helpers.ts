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


/** Factor del impuesto trasladado (c_TipoFactor del SAT). */
export type FactorIva = "Tasa" | "Exento";

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
    /**
     * Factor del impuesto trasladado del CFDI original.
     * `"Exento"` cuando la factura se emitió sin IVA por exención (fletes
     * internacionales, etc.). Default `"Tasa"`.
     */
    factor_iva?: FactorIva;
    /**
     * Ola 12 · R3P-19 — retenciones del CFDI original (tasa 0..1 por impuesto,
     * p. ej. IVA 4% ⇒ 0.04). Se emiten como RetencionesDR con la misma BaseDR
     * del traslado. Si la factura mezcla más de una tasa por impuesto,
     * index.ts bloquea el timbrado con LC_REP_RETENCIONES_NO_SOPORTADAS.
     */
    retenciones?: Array<{ tipo: "IVA" | "ISR"; tasa: number }>;
    /** Subtotal del CFDI original; requerido para la BaseDR cuando hay retenciones. */
    subtotal_factura?: number;
    /** Total del CFDI original; requerido para la BaseDR cuando hay retenciones. */
    total_factura?: number;
  };
  serie?: string | null;           // Serie del REP (si se usa serie distinta a las facturas)
  /** v13.208.0 — Expediente y BLs del embarque asociado. */
  referencias?: ReferenciasEmbarque | null;
}

export interface FacturapiRepPayload {
  type: "P";
  serie?: string;
  /** EF-01: external_id = claimTag PENDING:<uuid> para recuperación de huérfanos. */
  external_id?: string;
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
      date: string;
      numOperacion?: string;
      related_documents: Array<{
        uuid: string;
        folio_number?: string;
        series?: string;
        currency: string;
        exchange?: number;
        installment: number;
        last_balance: number;
        amount: number;
        /**
         * SAT/Facturapi exigen SIEMPRE el desglose de impuestos del documento
         * relacionado, incluso cuando la factura es exenta o tasa 0%.
         */
        // Ola 12 · R3P-19: admite retenciones (withholding: true, IVA/ISR).
        taxes: Array<{ type: "IVA" | "ISR"; rate: number; factor: FactorIva; withholding: boolean; base: number }>;
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
    // JAVASCRIPT-REACT-5D: el pago excede el saldo pendiente de la factura
    // (sobrepago o pago duplicado). El mensaje debe decirle al usuario qué
    // corregir, no sólo nombrar el campo del SAT.
    issues.push({
      field: "documento.imp_saldo_ant",
      message:
        `El pago (${ctx.documento_relacionado.imp_pagado.toFixed(2)}) es mayor al saldo pendiente de la factura ` +
        `(${ctx.documento_relacionado.imp_saldo_ant.toFixed(2)}). Ajusta el monto del pago o revisa si ya se aplicó otro pago a esta factura.`,
    });
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
            date: ctx.fecha_pago,
            related_documents: [
              {
                uuid: dr.uuid,
                currency: dr.moneda_dr,
                installment: dr.num_parcialidad,
                last_balance: round2(dr.imp_saldo_ant),
                amount: round2(dr.imp_pagado),
                taxes: buildTaxesDr(dr),
              },
            ],
          },
        ],
      },
    ],
  };

  if (ctx.serie) payload.serie = ctx.serie;
  if (ctx.receptor.email) payload.customer.email = ctx.receptor.email;
  if (ctx.numero_operacion) payload.complements[0].data[0].numOperacion = ctx.numero_operacion;
  if (ctx.moneda !== "MXN" && ctx.tipo_cambio > 0) {
    payload.complements[0].data[0].exchange = ctx.tipo_cambio;
  }

  const rdoc = payload.complements[0].data[0].related_documents[0];
  if (dr.folio) rdoc.folio_number = dr.folio;
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

/**
 * Impuestos del documento relacionado. Nunca se omite el arreglo: Facturapi
 * rechaza el REP con `complements.0.data.0.related_documents.0.taxes es
 * requerido` cuando la factura original no trae IVA. Para facturas exentas se
 * declara factor `Exento` con tasa 0.
 */
export function buildTaxesDr(
  dr: Pick<PagoContext["documento_relacionado"], "tasa_iva" | "imp_pagado" | "factor_iva" | "retenciones" | "subtotal_factura" | "total_factura">,
): FacturapiRepPayload["complements"][0]["data"][0]["related_documents"][0]["taxes"] {
  const tasa = dr.tasa_iva > 0 ? dr.tasa_iva : 0;
  const factor: FactorIva = tasa > 0 ? "Tasa" : (dr.factor_iva ?? "Tasa");
  // Ola 12 · R3P-18 (guía de llenado SAT, complemento de pagos 2.0): la BaseDR
  // es SIN IVA. Con tasa 0 / exento la base es el pago completo (v13.559.1).
  const base = tasa > 0 ? baseDrSinIva(dr) : round2(dr.imp_pagado);
  const taxes: FacturapiRepPayload["complements"][0]["data"][0]["related_documents"][0]["taxes"] =
    [{ type: "IVA", rate: tasa, factor, withholding: false, base }];
  // Ola 12 · R3P-19: RetencionesDR con la misma BaseDR (el PAC calcula
  // ImporteDR = base × tasa y los totales TotalRetenciones*).
  for (const ret of dr.retenciones ?? []) {
    if (ret.tasa > 0) {
      taxes.push({ type: ret.tipo, rate: ret.tasa, factor: "Tasa", withholding: true, base });
    }
  }
  return taxes;
}

/**
 * R3P-18: BaseDR sin IVA. Sin retenciones: imp_pagado/(1+tasa). Con
 * retenciones el total del CFDI no es subtotal·(1+tasa), así que se usa la
 * proporción subtotal/total del documento original.
 */
function baseDrSinIva(
  dr: Pick<PagoContext["documento_relacionado"], "tasa_iva" | "imp_pagado" | "retenciones" | "subtotal_factura" | "total_factura">,
): number {
  const hayRetenciones = (dr.retenciones ?? []).some((r) => r.tasa > 0);
  const sub = Number(dr.subtotal_factura ?? 0);
  const tot = Number(dr.total_factura ?? 0);
  if (hayRetenciones && sub > 0 && tot > 0) {
    return round2((dr.imp_pagado * sub) / tot);
  }
  return round2(dr.imp_pagado / (1 + dr.tasa_iva));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
