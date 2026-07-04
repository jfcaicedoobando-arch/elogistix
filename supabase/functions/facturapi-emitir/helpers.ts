/**
 * Helpers para construir el payload Facturapi a partir de una factura interna.
 * Mantenemos pura la lógica para poder testearla sin red.
 *
 * Facturapi docs: https://docs.facturapi.io/api/
 */

export interface ConceptoInterno {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  clave_sat?: string | null;
  clave_unidad?: string | null;
  unidad?: string | null;
  tasa_iva?: number | null; // 0.16, 0, etc.
  tipo_iva?: "gravado_16" | "tasa_0" | "exento" | null;
}

export interface FacturaContext {
  serie?: string | null;
  forma_pago: string;        // SAT 01, 03, 99 ...
  metodo_pago: string;       // PUE / PPD
  uso_cfdi: string;          // G03, P01, etc.
  moneda: string;            // MXN / USD
  tipo_cambio: number;
  receptor: {
    legal_name: string;
    tax_id: string;
    tax_system: string;      // régimen SAT 601, 612, etc.
    address: { zip: string };
    email?: string | null;
  };
  conceptos: ConceptoInterno[];
  /** UUID de la factura sustituida cuando este CFDI la reemplaza (relación SAT 04). */
  sustituye_uuid?: string | null;
}


export interface FacturapiPayload {
  type: "I";
  serie?: string;
  use: string;
  payment_form: string;
  payment_method: string;
  currency: string;
  exchange?: number;
  related?: string[];
  relation?: string;
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
      taxes: Array<{ type: "IVA"; rate: number; factor: "Tasa" | "Exento" }>;
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

export function validateContext(ctx: FacturaContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isValidRfc(ctx.receptor.tax_id)) issues.push({ field: "rfc", message: "RFC inválido" });
  if (!isValidZip(ctx.receptor.address.zip)) issues.push({ field: "codigo_postal", message: "Código postal del receptor requerido (5 dígitos)" });
  if (!ctx.receptor.tax_system) issues.push({ field: "regimen_fiscal", message: "Régimen fiscal del receptor requerido" });
  if (!ctx.uso_cfdi) issues.push({ field: "uso_cfdi", message: "Uso de CFDI requerido" });
  if (!ctx.forma_pago) issues.push({ field: "forma_pago", message: "Forma de pago SAT requerida" });
  if (!ctx.metodo_pago) issues.push({ field: "metodo_pago", message: "Método de pago SAT requerido (PUE/PPD)" });
  if (!ctx.conceptos.length) issues.push({ field: "conceptos", message: "La factura no tiene conceptos" });
  ctx.conceptos.forEach((c, i) => {
    if (!c.clave_sat) issues.push({ field: `conceptos[${i}].clave_sat`, message: `Concepto "${c.descripcion}" sin clave SAT` });
    if (!c.clave_unidad) issues.push({ field: `conceptos[${i}].clave_unidad`, message: `Concepto "${c.descripcion}" sin clave de unidad SAT` });
    if (c.cantidad <= 0) issues.push({ field: `conceptos[${i}].cantidad`, message: `Cantidad inválida` });
    if (c.precio_unitario < 0) issues.push({ field: `conceptos[${i}].precio_unitario`, message: `Precio inválido` });
  });
  return issues;
}

export function buildFacturapiPayload(ctx: FacturaContext): FacturapiPayload {
  const payload: FacturapiPayload = {
    type: "I",
    use: ctx.uso_cfdi,
    payment_form: ctx.forma_pago,
    payment_method: ctx.metodo_pago,
    currency: ctx.moneda,
    customer: {
      legal_name: ctx.receptor.legal_name,
      tax_id: ctx.receptor.tax_id.trim().toUpperCase(),
      tax_system: ctx.receptor.tax_system,
      address: { zip: ctx.receptor.address.zip.trim() },
    },
    items: ctx.conceptos.map((c) => {
      const tipo = c.tipo_iva ?? (c.tasa_iva === 0 ? "tasa_0" : "gravado_16");
      const taxes = tipo === "exento"
        ? [{ type: "IVA" as const, factor: "Exento" as const }]
        : [{ type: "IVA" as const, rate: tipo === "tasa_0" ? 0 : (c.tasa_iva ?? 0.16), factor: "Tasa" as const }];
      return {
        quantity: c.cantidad,
        product: {
          description: c.descripcion,
          product_key: c.clave_sat ?? "",
          price: c.precio_unitario,
          unit_key: c.clave_unidad ?? "E48",
          unit_name: c.unidad ?? "Unidad de servicio",
          tax_included: false,
          taxes,
        },
      };
    }),
  };
  if (ctx.serie) payload.serie = ctx.serie;
  if (ctx.receptor.email) payload.customer.email = ctx.receptor.email;
  if (ctx.moneda !== "MXN" && ctx.tipo_cambio > 0) payload.exchange = ctx.tipo_cambio;
  if (ctx.sustituye_uuid) {
    // SAT relación 04 = "Sustitución de los CFDI previos"
    payload.related = [ctx.sustituye_uuid];
    payload.relation = "04";
  }
  return payload;
}


export const FACTURAPI_BASE = "https://www.facturapi.io/v2";

export function basicAuthHeader(apiKey: string): string {
  // Facturapi: usuario = api key, password vacío.
  const g = globalThis as { Buffer?: { from: (s: string) => { toString: (enc: string) => string } } };
  const b64 = typeof btoa === "function"
    ? btoa(`${apiKey}:`)
    : g.Buffer!.from(`${apiKey}:`).toString("base64");
  return `Basic ${b64}`;
}
