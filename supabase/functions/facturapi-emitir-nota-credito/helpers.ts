/**
 * Helpers para construir el payload de Facturapi al timbrar una Nota de Crédito
 * (CFDI tipo E, related = UUID de la factura original, relationship = '01').
 *
 * Lógica pura — sin red, sin Supabase — para que sea testeable con Deno test.
 */
import {
  formatDescripcionConReferencias,
  buildPdfCustomSection,
  type ReferenciasEmbarque,
} from "../_shared/referenciasEmbarque.ts";
export type { ReferenciasEmbarque } from "../_shared/referenciasEmbarque.ts";
import { validarTcFiscal } from "../_shared/tcBanda.ts";
import {
  esLineaNoObjeto,
  MSG_NO_OBJETO_RETENCIONES,
  retencionesIncompatiblesNoObjeto,
} from "../_shared/noObjetoFiscal.ts";

export interface ConceptoNC {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  clave_sat?: string | null;
  clave_unidad?: string | null;
  unidad?: string | null;
  tasa_iva?: number | null;
  /** Ola 4 · N19: mismo contrato que el timbrado de facturas. */
  tipo_iva?: "gravado_16" | "gravado_8" | "tasa_0" | "exento" | "no_objeto" | null;
  /** P1-IVA — retención de ISR del renglón original (0.10 = 10%); la NC la reversa. */
  tasa_ret_isr?: number | null;
  /** P1-IVA — retención de IVA del renglón original (0.04, 0.106667); la NC la reversa. */
  tasa_ret_iva?: number | null;
}

export interface NotaCreditoContext {
  serie?: string | null;
  uso_cfdi: string;
  forma_pago: string;
  moneda: string;
  tipo_cambio: number;
  uuid_factura_relacionada: string;
  receptor: {
    legal_name: string;
    tax_id: string;
    tax_system: string;
    address: { zip: string };
    email?: string | null;
  };
  conceptos: ConceptoNC[];
  /** v13.208.0 — Expediente y BLs del embarque para propagar al CFDI y al PDF. */
  referencias?: ReferenciasEmbarque | null;
  /**
   * Ola 4 · N1 — tag de correlación enviado como `external_id` a FacturAPI.
   * Coincide con el claim `PENDING:<uuid>` de la fila (patrón FIX-04.1 de
   * facturapi-emitir) para recuperar el CFDI si perdemos la respuesta.
   */
  external_id?: string | null;
}

export interface FacturapiNcPayload {
  type: "E";
  serie?: string;
  use: string;
  payment_form: string;
  /** Los CFDI de egreso no admiten parcialidades: siempre PUE. */
  payment_method: "PUE";
  currency: string;
  exchange?: number;
  /** Ola 4 · N1 — tag de correlación PENDING:<uuid>. */
  external_id?: string;
  related: string[];
  relationship: "01";
  /** v13.208.0 — Bloque HTML libre que FacturAPI imprime al pie del PDF. */
  pdf_custom_section?: string;
  customer: {
    legal_name: string;
    tax_id: string;
    tax_system: string;
    address: { zip: string };
    email?: string;
  };
  items: Array<{
    quantity: number;
    product: {
      description: string;
      product_key: string;
      price: number;
      unit_key: string;
      unit_name: string;
      tax_included: false;
      /** ObjetoImp SAT: "01" = no objeto de impuesto, "02" = sí objeto (default). */
      taxability?: "01" | "02";
      taxes: Array<{
        type: "IVA" | "ISR";
        rate: number;
        factor: "Tasa" | "Exento";
        withholding?: boolean;
      }>;
    };
  }>;
}

const RFC_RX = /^([A-ZÑ&]{3,4})\d{6}(?:[A-Z\d]{2}[A\d0-9])$/i;

export function isValidRfc(rfc: string | null | undefined): boolean {
  if (!rfc) return false;
  const v = rfc.trim().toUpperCase();
  if (v === "XAXX010101000" || v === "XEXX010101000") return true;
  return RFC_RX.test(v);
}

export function isValidZip(zip: string | null | undefined): boolean {
  return !!zip && /^\d{5}$/.test(zip.trim());
}

export interface ValidationIssue { field: string; message: string }

export function validateNcContext(ctx: NotaCreditoContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!ctx.uuid_factura_relacionada) issues.push({ field: "factura", message: "La factura original no tiene UUID fiscal" });
  if (!isValidRfc(ctx.receptor.tax_id)) issues.push({ field: "rfc", message: "RFC inválido" });
  if (!isValidZip(ctx.receptor.address.zip)) issues.push({ field: "codigo_postal", message: "Código postal del receptor requerido" });
  if (!ctx.receptor.tax_system) issues.push({ field: "regimen_fiscal", message: "Régimen fiscal requerido" });
  if (!ctx.uso_cfdi) issues.push({ field: "uso_cfdi", message: "Uso de CFDI requerido (usualmente G02 para NC)" });
  if (!ctx.forma_pago) issues.push({ field: "forma_pago", message: "Forma de pago SAT requerida" });
  if (!ctx.conceptos.length) issues.push({ field: "conceptos", message: "La nota de crédito no tiene conceptos" });
  // Ola 2 · B: banda canónica compartida (5..40 MXN por divisa). Antes bastaba
  // con "> 1", así que un 4.99 o un 100 timbraba importes en MXN equivocados.
  const problemaTc = validarTcFiscal(ctx.moneda, ctx.tipo_cambio);
  if (problemaTc) issues.push({ field: "tipo_cambio", message: problemaTc });
  ctx.conceptos.forEach((c, i) => {
    if (!c.clave_sat) issues.push({ field: `conceptos[${i}].clave_sat`, message: `Concepto "${c.descripcion}" sin clave SAT` });
    if (!c.clave_unidad) issues.push({ field: `conceptos[${i}].clave_unidad`, message: `Concepto "${c.descripcion}" sin clave de unidad` });
    if (c.cantidad <= 0) issues.push({ field: `conceptos[${i}].cantidad`, message: "Cantidad inválida" });
    if (c.precio_unitario < 0) issues.push({ field: `conceptos[${i}].precio_unitario`, message: "Precio inválido" });
    if (tratamientoNcIndeterminado(c)) {
      issues.push({
        field: `conceptos[${i}].tipo_iva`,
        message: `Concepto "${c.descripcion}" sin tratamiento fiscal de IVA definido (gravado 16%, 8%, tasa 0%, exento o no objeto). Defínelo en la factura original y vuelve a generar la nota de crédito: no se supone una tasa.`,
      });
    }
    // P1-IVA: tipo y tasa contradictorios (gravado 16% con 0.08) bloquean:
    // no se elige silenciosamente ninguno de los dos datos.
    if (tasaNcIncoherente(c)) {
      issues.push({
        field: `conceptos[${i}].tasa_iva`,
        message: `Concepto "${c.descripcion}" tiene un tratamiento fiscal (${c.tipo_iva}) que no coincide con su tasa de IVA guardada (${c.tasa_iva}). Corrige la factura original y vuelve a generar la nota de crédito.`,
      });
    }
    // P1 · IVA — ObjetoImp 01 no admite nodo de impuestos ni en el egreso.
    if (retencionesIncompatiblesNoObjeto(c)) {
      issues.push({
        field: `conceptos[${i}].retenciones`,
        message: `Concepto "${c.descripcion}": ${MSG_NO_OBJETO_RETENCIONES}`,
      });
    }

  });
  return issues;
}

/**
 * Ola 4 · A — total monetario de la NC (sin impuestos): base para bloquear las
 * notas de crédito en $0. Espejo de `validarTotalPositivo` de facturapi-emitir:
 * `validateNcContext` sólo exige cantidad > 0 y precio >= 0, así que una NC con
 * todos los precios en 0 pasaba la validación local y llegaba al PAC.
 */
export function totalNcSinImpuestos(ctx: NotaCreditoContext): number {
  return ctx.conceptos.reduce(
    (acc, c) => acc + Number(c.cantidad ?? 0) * Number(c.precio_unitario ?? 0),
    0,
  );
}

/** `null` = puede continuar; si no, motivo del bloqueo (422 nc_total_cero). */
export function ncTotalEsCero(ctx: NotaCreditoContext): boolean {
  return !(totalNcSinImpuestos(ctx) > 0);
}

/**
 * Ola 4 · N19: un concepto exento se timbra con factor "Exento", no "Tasa" 0.
 * "no_objeto" (ObjetoImp 01) no lleva traslado alguno de IVA.
 *
 * P1-IVA: la tasa SIEMPRE es la canónica del tratamiento (0.16 / 0.08 / 0).
 * Nunca se usa la tasa guardada del renglón: un `gravado_16` con tasa 0.08
 * construía un traslado al 8%. Las combinaciones imposibles se bloquean antes
 * en `validateNcContext`; aquí un tipo no reconocido lanza en vez de suponer.
 */
const TASA_CANONICA_NC: Record<string, number> = {
  gravado_16: 0.16,
  gravado_8: 0.08,
  tasa_0: 0,
  exento: 0,
  no_objeto: 0,
};

export function buildTaxesNc(c: ConceptoNC) {
  type Tax = { type: "IVA" | "ISR"; rate: number; factor: "Tasa" | "Exento"; withholding?: boolean };
  const tipo = c.tipo_iva;
  if (tipo == null || !TIPOS_IVA_NC.includes(tipo)) {
    throw new Error(
      `Concepto "${c.descripcion}" sin tratamiento fiscal de IVA reconocido: no se puede construir el CFDI.`,
    );
  }
  const taxes: Tax[] = [];
  const noObjeto = esLineaNoObjeto(c);
  if (tipo === "exento") {
    taxes.push({ type: "IVA", rate: 0, factor: "Exento" });
  } else if (!noObjeto) {
    taxes.push({ type: "IVA", rate: TASA_CANONICA_NC[tipo], factor: "Tasa" });
  }
  // P1-IVA — las retenciones de la factura se reversan en la NC (mismo shape
  // que facturapi-emitir/helpers.ts): omitirlas cambiaba el total del CFDI.
  // P1 · Auditoría — con ObjetoImp 01 el arreglo queda VACÍO: `validateNcContext`
  // bloquea la combinación y aquí las retenciones nunca se agregan.
  const retIsr = noObjeto ? 0 : Number(c.tasa_ret_isr ?? 0);
  const retIva = noObjeto ? 0 : Number(c.tasa_ret_iva ?? 0);
  if (retIsr > 0) taxes.push({ type: "ISR", rate: retIsr, factor: "Tasa", withholding: true });
  if (retIva > 0) taxes.push({ type: "IVA", rate: retIva, factor: "Tasa", withholding: true });
  return taxes;
}

/**
 * P1-IVA — Tratamientos representables en el CFDI de egreso. Un renglón sin
 * tipo reconocido es INDETERMINADO: se bloquea el timbrado en vez de suponer
 * 16% (una tasa numérica suelta no dice si el original era tasa 0%, exento o
 * no objeto: son tres declaraciones distintas ante el SAT).
 */
const TIPOS_IVA_NC: readonly string[] = [
  "gravado_16",
  "gravado_8",
  "tasa_0",
  "exento",
  "no_objeto",
];

export function tratamientoNcIndeterminado(c: ConceptoNC): boolean {
  return c.tipo_iva == null || !TIPOS_IVA_NC.includes(c.tipo_iva);
}

/**
 * P1-IVA — `true` cuando la tasa guardada del renglón contradice su tratamiento
 * (p. ej. `gravado_16` con 0.08). No se elige una de las dos: se bloquea.
 */
export function tasaNcIncoherente(c: ConceptoNC): boolean {
  if (tratamientoNcIndeterminado(c)) return false;
  const tasa = c.tasa_iva;
  if (tasa === null || tasa === undefined || !Number.isFinite(Number(tasa))) return false;
  return Math.abs(Number(tasa) - TASA_CANONICA_NC[c.tipo_iva as string]) >= 1e-9;
}

export function buildNcPayload(ctx: NotaCreditoContext): FacturapiNcPayload {
  const payload: FacturapiNcPayload = {
    type: "E",
    use: ctx.uso_cfdi,
    payment_form: ctx.forma_pago,
    // Guía de llenado del SAT: un egreso no admite parcialidades ni REP.
    payment_method: "PUE",
    currency: ctx.moneda,
    related: [ctx.uuid_factura_relacionada],
    relationship: "01",
    customer: {
      legal_name: ctx.receptor.legal_name,
      tax_id: ctx.receptor.tax_id.trim().toUpperCase(),
      tax_system: ctx.receptor.tax_system,
      address: { zip: ctx.receptor.address.zip.trim() },
    },
    items: ctx.conceptos.map((c) => ({
      quantity: c.cantidad,
      product: {
        // v13.208.0 — prefijo con Expediente + BLs.
        description: formatDescripcionConReferencias(c.descripcion, ctx.referencias),
        product_key: c.clave_sat ?? "",
        price: c.precio_unitario,
        unit_key: c.clave_unidad ?? "E48",
        unit_name: c.unidad ?? "Unidad de servicio",
        tax_included: false,
        // ObjetoImp SAT 01; se omite para el resto (Facturapi asume "02").
        ...(c.tipo_iva === "no_objeto" ? { taxability: "01" as const } : {}),
        taxes: buildTaxesNc(c),
      },
    })),
  };
  if (ctx.serie) payload.serie = ctx.serie;
  if (ctx.receptor.email) payload.customer.email = ctx.receptor.email;
  if (ctx.moneda !== "MXN" && ctx.tipo_cambio > 0) payload.exchange = ctx.tipo_cambio;
  // Ola 4 · N1 — tag de correlación para recuperar CFDIs "huérfanos".
  // P0-B: el MISMO tag viaja como `idempotency_key` (dedup oficial de FacturAPI).
  if (ctx.external_id) {
    payload.external_id = ctx.external_id;
    payload.idempotency_key = ctx.external_id;
  }
  // v13.208.0 — bloque "Referencias del embarque" al pie del PDF.
  const pdfSection = buildPdfCustomSection(ctx.referencias);
  if (pdfSection) payload.pdf_custom_section = pdfSection;
  return payload;
}
