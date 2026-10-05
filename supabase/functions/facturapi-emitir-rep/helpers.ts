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
import { CLAVES_FORMA_PAGO_SAT } from "../_shared/formaMetodoPago.ts";
import { buildTaxesDr, round2 } from "./taxesDr.ts";
// Re-export para los tests/llamadores que lo importan desde helpers.
export { buildTaxesDr, round2 } from "./taxesDr.ts";


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
  tipo_cambio: number;      // Valuación MXN/divisa; MXN cruzado guarda TC convenido, TipoCambioP sigue 1
  monto: number;            // Monto del pago en la moneda del pago
  numero_operacion?: string | null;
  // Documento relacionado (la factura original)
  documento_relacionado: {
    uuid: string;                  // UUID del CFDI original
    folio?: string | null;
    serie?: string | null;
    moneda_dr: string;             // Moneda de la factura original
    tipo_cambio_dr: number;        // Valuación de emisión; NO determina EquivalenciaDR del cobro
    num_parcialidad: number;       // 1, 2, 3...
    imp_saldo_ant: number;         // Saldo antes de este pago, en moneda_dr
    imp_pagado: number;            // Importe que este pago abona en moneda_dr
    imp_saldo_insoluto: number;    // Saldo después de este pago
    metodo_pago: "PPD";            // siempre PPD para REP
    /** Tasa del primer grupo (compatibilidad y facturas sin renglones). */
    tasa_iva: number;
    /**
     * P1 · Auditoría IVA — grupos de traslado del CFDI original (uno por
     * combinación factor+tasa) con su importe sin IVA. Cuando viene con 1+
     * grupos, `buildTaxesDr` declara un impuesto por grupo y prorratea la
     * BaseDR con el importe; así una factura 16% + 0% (o 16% + 8%) sí puede
     * cobrarse por parcialidades sin declarar una tasa promedio.
     */
    grupos_iva?: Array<{ tasa: number; factor: FactorIva; importe: number }>;
    /**
     * Factor del impuesto trasladado del CFDI original.
     * `"Exento"` cuando la factura se emitió sin IVA por exención (fletes
     * internacionales, etc.). Default `"Tasa"`.
     */
    factor_iva?: FactorIva;
    /**
     * Retenciones del CFDI original (tasa 0..1 por impuesto, p. ej. IVA 4% ⇒
     * 0.04). El SAT admite RetencionDR de 1 a ilimitado con su propia BaseDR.
     *
     * P1 · Auditoría IVA — `importe` es la suma (sin IVA) de los renglones que
     * traen esa retención; con él la BaseDR se prorratea igual que los
     * traslados. Sin `importe` (facturas legacy sin renglones) se conserva el
     * comportamiento histórico: la base total del documento.
     */
    retenciones?: Array<{ tipo: "IVA" | "ISR"; tasa: number; importe?: number }>;
    /** Subtotal del CFDI original; requerido para la BaseDR cuando hay retenciones. */
    subtotal_factura?: number;
    /** Total del CFDI original; requerido para la BaseDR cuando hay retenciones. */
    total_factura?: number;
    /**
     * `true` cuando la factura relacionada tiene al menos un renglón
     * "No objeto de impuesto" (SAT ObjetoImp 01). Informativo: el tratamiento
     * que viaja al PAC es `objeto_imp_dr` (`taxability` del documento
     * relacionado en la vía estructurada de Facturapi).
     */
    hay_no_objeto?: boolean;
    /** ObjetoImpDR del documento: "01" si TODOS sus renglones son no objeto. */
    objeto_imp_dr?: "01" | "02";
    /** Importe (sin IVA) de los renglones no objeto; sólo entra al denominador. */
    importe_no_objeto?: number;
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
         * `ObjetoImpDR` del documento relacionado (SDK 5.1.0 ·
         * `PaymentRelatedDocument.taxability`): "01" sólo cuando TODOS sus
         * renglones son "No objeto de impuesto"; "02" en cualquier otro caso.
         */
        taxability: "01" | "02";
        /**
         * SAT/Facturapi exigen el desglose de impuestos del documento
         * relacionado con `taxability = "02"`, incluso si es exento o tasa 0%.
         * Con `taxability = "01"` va vacío: el SAT prohíbe `ImpuestosDR`.
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
};

export const MSG_REP_FORMA_PAGO_INVALIDA =
  "La forma de pago del cobro no es válida para el complemento de pago: el SAT exige una clave " +
  "real del catálogo c_FormaPago (efectivo, transferencia, cheque, tarjeta…) distinta de 99 " +
  "(Por definir). Corrige la forma de pago del cobro registrado y vuelve a intentar el timbrado.";

/**
 * P1 · Auditoría fiscal — FormaDePagoP del REP: el pago YA se recibió, así que
 * nunca se inventa un 99. Devuelve `null` cuando el dato está ausente, fuera
 * del catálogo o es 99/"Otro": el timbrado se detiene ANTES del PAC y el pago
 * queda registrado con su estado de error reintentable.
 */
export function normalizarFormaPago(formaPago: string | null | undefined): string | null {
  if (!formaPago) return null;
  const v = formaPago.trim();
  if (v === "") return null;
  if (/^\d{2}$/.test(v)) {
    if (v === "99") return null;
    return CLAVES_FORMA_PAGO_SAT.includes(v) ? v : null;
  }
  const key = v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return FORMA_PAGO_MAP[key] ?? null;
}

/**
 * FormaDePagoP obligatoria para armar el payload. `validateRepContext` ya
 * bloquea el caso inválido antes del claim; esto es la red de seguridad para
 * que ningún camino envíe 99 o una clave fuera de catálogo al PAC.
 */
export function formaPagoRepObligatoria(formaPago: string | null | undefined): string {
  const codigo = normalizarFormaPago(formaPago);
  if (codigo === null) throw new Error(MSG_REP_FORMA_PAGO_INVALIDA);
  return codigo;
}

function valuacionPagoValida(ctx: PagoContext): boolean {
  return ctx.moneda === "MXN" || (Number.isFinite(ctx.tipo_cambio) && ctx.tipo_cambio >= 5 && ctx.tipo_cambio <= 40);
}

export function validateRepContext(ctx: PagoContext): RepValidationIssue[] {
  const issues: RepValidationIssue[] = [];
  if (!isValidRfc(ctx.receptor.tax_id)) issues.push({ field: "rfc", message: "RFC del receptor inválido" });
  if (!isValidZip(ctx.receptor.address.zip)) issues.push({ field: "codigo_postal", message: "Código postal del receptor requerido (5 dígitos)" });
  if (!ctx.receptor.tax_system) issues.push({ field: "regimen_fiscal", message: "Régimen fiscal del receptor requerido" });
  if (normalizarFormaPago(ctx.forma_pago) === null) {
    issues.push({ field: "forma_pago", message: MSG_REP_FORMA_PAGO_INVALIDA });
  }
  if (!ctx.fecha_pago) issues.push({ field: "fecha_pago", message: "Fecha de pago requerida" });
  if (!Number.isFinite(ctx.monto) || !(ctx.monto > 0)) issues.push({ field: "monto", message: "Monto del pago debe ser mayor a 0" });
  if (!valuacionPagoValida(ctx)) {
    issues.push({ field: "tipo_cambio", message: "Captura la valuación en MXN del cobro (5 a 40 MXN por divisa); el factor neutral 1 no es una valuación" });
  }
  if (equivalenciaDelCobro(ctx) === null) {
    issues.push({ field: "documento.equivalencia_dr", message:
      "El importe recibido y el aplicado no permiten representar el cobro con la precisión del REP. Revisa los importes y su equivalencia antes de timbrar." });
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
 * AUD92: EquivalenciaDR = unidades de la factura por unidad recibida.
 * Facturapi PaymentInput no admite Monto directo: lo deriva de amount/exchange.
 * Usamos los importes que realmente se serializan (2 decimales para MXN/USD/EUR),
 * no el TC histórico de emisión. La verificación impide alterar Monto por redondeo.
 * Referencia: docs.facturapi.io/redocusaurus/api-es.yaml, PaymentInput (2026-10-05).
 */
export function equivalenciaDelCobro(ctx: PagoContext): number | null {
  const recibido = round2(ctx.monto);
  const aplicado = round2(ctx.documento_relacionado.imp_pagado);
  if (!Number.isFinite(recibido) || !Number.isFinite(aplicado) || recibido <= 0 || aplicado <= 0) return null;
  if (ctx.moneda === ctx.documento_relacionado.moneda_dr) return recibido === aplicado ? 1 : null;
  const factor = Math.round((aplicado / recibido) * 1e10) / 1e10;
  return factor > 0 && round2(aplicado / factor) === recibido ? factor : null;
}

/**
 * Construye el payload Facturapi para timbrar el REP.
 * Si moneda del pago == moneda del documento, no enviamos `exchange` en el doc relacionado.
 */

export function buildRepPayload(ctx: PagoContext): FacturapiRepPayload {
  if (!valuacionPagoValida(ctx)) throw new Error("La valuación del cobro en MXN no es verificable.");
  const dr = ctx.documento_relacionado;
  const sameCurrency = ctx.moneda === dr.moneda_dr;
  const equivalencia = equivalenciaDelCobro(ctx);
  if (equivalencia === null) throw new Error("El REP no puede representar el importe recibido sin alterarlo.");

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
            payment_form: formaPagoRepObligatoria(ctx.forma_pago),
            currency: ctx.moneda,
            date: ctx.fecha_pago,
            related_documents: [
              {
                uuid: dr.uuid,
                currency: dr.moneda_dr,
                installment: dr.num_parcialidad,
                last_balance: round2(dr.imp_saldo_ant),
                amount: round2(dr.imp_pagado),
                // ObjetoImpDR real; fallback seguro "02" (declara impuestos).
                taxability: dr.objeto_imp_dr ?? "02",
                // `buildTaxesDr` devuelve [] cuando taxability = "01".
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
  // AUD92: nunca reconstruir el dinero recibido con la valuación de emisión.
  if (!sameCurrency) rdoc.exchange = equivalencia;

  // v13.208.0 — Bloque "Referencias del embarque" al pie del PDF.
  const pdfSection = buildPdfCustomSection(ctx.referencias);
  if (pdfSection) payload.pdf_custom_section = pdfSection;

  return payload;
}
