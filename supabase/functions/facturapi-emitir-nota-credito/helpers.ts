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

export interface ConceptoNC {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  clave_sat?: string | null;
  clave_unidad?: string | null;
  unidad?: string | null;
  tasa_iva?: number | null;
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
      taxes: Array<{ type: "IVA"; rate: number; factor: "Tasa" }>;
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
  ctx.conceptos.forEach((c, i) => {
    if (!c.clave_sat) issues.push({ field: `conceptos[${i}].clave_sat`, message: `Concepto "${c.descripcion}" sin clave SAT` });
    if (!c.clave_unidad) issues.push({ field: `conceptos[${i}].clave_unidad`, message: `Concepto "${c.descripcion}" sin clave de unidad` });
    if (c.cantidad <= 0) issues.push({ field: `conceptos[${i}].cantidad`, message: "Cantidad inválida" });
    if (c.precio_unitario < 0) issues.push({ field: `conceptos[${i}].precio_unitario`, message: "Precio inválido" });
  });
  return issues;
}

export function buildNcPayload(ctx: NotaCreditoContext): FacturapiNcPayload {
  const payload: FacturapiNcPayload = {
    type: "E",
    use: ctx.uso_cfdi,
    payment_form: ctx.forma_pago,
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
        taxes: [{ type: "IVA", rate: c.tasa_iva ?? 0.16, factor: "Tasa" }],
      },
    })),
  };
  if (ctx.serie) payload.serie = ctx.serie;
  if (ctx.receptor.email) payload.customer.email = ctx.receptor.email;
  if (ctx.moneda !== "MXN" && ctx.tipo_cambio > 0) payload.exchange = ctx.tipo_cambio;
  // Ola 4 · N1 — tag de correlación para recuperar CFDIs "huérfanos".
  if (ctx.external_id) payload.external_id = ctx.external_id;
  // v13.208.0 — bloque "Referencias del embarque" al pie del PDF.
  const pdfSection = buildPdfCustomSection(ctx.referencias);
  if (pdfSection) payload.pdf_custom_section = pdfSection;
  return payload;
}
