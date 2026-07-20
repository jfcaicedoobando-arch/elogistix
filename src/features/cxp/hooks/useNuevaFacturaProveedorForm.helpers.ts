/**
 * Helpers puros para `useNuevaFacturaProveedorForm`.
 * Extraídos para mantener el hook controller ≤200 líneas (Power-of-10).
 * Sin React, sin Supabase: testeables en aislamiento.
 */
import type { Database } from "@/integrations/supabase/types";
import type { FacturaFormValues } from "@/features/cxp/components/facturaFormPrimitives";
import { todayLocalISO } from "@/lib/date/today";

export type Moneda = Database["public"]["Enums"]["moneda"];

export interface PendingCfdi {
  uuid: string;
  rfcEmisor: string;
  xmlFile: File;
  pdfFile: File | null;
}

export interface VinculoLinea {
  embarqueId: string;
  montoOriginal: number;
  descripcion: string;
  monto: number;
}

export function addDays(iso: string, days: number): string {
  // Blindaje: si la emisión viene vacía o no es un ISO YYYY-MM-DD, devolvemos ""
  // en lugar de crashear con RangeError: Invalid time value.
  // Sentry: JAVASCRIPT-REACT-29.
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const today = () => todayLocalISO();

export function initialValues(): FacturaFormValues {
  const t = today();
  return {
    provId: "", provNombre: "", folio: "",
    emision: t, diasCredito: 30, vencimiento: addDays(t, 30),
    moneda: "MXN", tc: "",
    subtotal: "", iva: "", ieps: "", retenciones: "",
    categoriaId: "", notas: "",
  };
}

export function calcularTotal(values: FacturaFormValues): number {
  const s = Number(values.subtotal) || 0;
  const i = Number(values.iva) || 0;
  const e = Number(values.ieps) || 0;
  const r = Number(values.retenciones) || 0;
  return s + i + e - r;
}

export function validateFactura(
  values: FacturaFormValues,
  total: number,
): Partial<Record<keyof FacturaFormValues, string>> {
  const next: Partial<Record<keyof FacturaFormValues, string>> = {};
  if (!values.provId) next.provId = "Selecciona un proveedor";
  if (!values.folio.trim()) next.folio = "Captura el folio del proveedor";
  if (!values.categoriaId) next.categoriaId = "Selecciona una categoría contable";
  if (total <= 0) next.subtotal = "El total debe ser mayor a 0";
  if (values.moneda !== "MXN" && !(Number(values.tc) > 0)) {
    next.tc = "Captura el tipo de cambio";
  }
  return next;
}

/** Si todos los vínculos comparten un único embarque, lo devuelve. */
export function embarqueIdUnico(vinculos: Record<string, VinculoLinea>): string | null {
  const ids = new Set(Object.values(vinculos).map((v) => v.embarqueId));
  return ids.size === 1 ? [...ids][0] : null;
}

interface BuildPayloadParams {
  values: FacturaFormValues;
  total: number;
  userId: string | undefined;
  pendingCfdi: PendingCfdi | null;
  vinculos: Record<string, VinculoLinea>;
}

export function buildPayload({ values, total, userId, pendingCfdi, vinculos }: BuildPayloadParams) {
  return {
    proveedor_id: values.provId,
    proveedor_nombre: values.provNombre,
    folio_proveedor: values.folio.trim(),
    fecha_emision: values.emision,
    fecha_vencimiento: values.vencimiento,
    dias_credito: Number(values.diasCredito) || 0,
    moneda: values.moneda,
    tipo_cambio_usd: Number(values.tc) || 0,
    subtotal: Number(values.subtotal) || 0,
    iva: Number(values.iva) || 0,
    ieps: Number(values.ieps) || 0,
    retenciones: Number(values.retenciones) || 0,
    total,
    estado: "Vigente" as const,
    notas: values.notas,
    categoria_presupuesto_id: values.categoriaId,
    created_by: userId,
    uuid_fiscal: pendingCfdi?.uuid ?? null,
    rfc_proveedor: pendingCfdi?.rfcEmisor ?? null,
    embarque_id: embarqueIdUnico(vinculos),
  };
}

export function mapCfdiToValues(
  data: { cfdi: { moneda: string; serie: string | null; folio: string | null; uuid: string; fecha: string; tipo_cambio: number; subtotal: number; iva_trasladado: number; ieps_trasladado?: number; retenciones: number }; ai: { categoria_id: string | null; notas: string | null } },
  provId: string,
  provNombre: string,
): FacturaFormValues {
  const c = data.cfdi;
  const monedaValida: Moneda = c.moneda === "USD" || c.moneda === "EUR" ? c.moneda : "MXN";
  const ieps = Number(c.ieps_trasladado ?? 0);
  return {
    provId, provNombre,
    folio: [c.serie, c.folio].filter(Boolean).join("-") || c.uuid.slice(0, 8),
    emision: c.fecha || today(),
    diasCredito: 30,
    vencimiento: addDays(c.fecha || today(), 30),
    moneda: monedaValida,
    tc: monedaValida === "MXN" ? "" : String(c.tipo_cambio || ""),
    subtotal: String(c.subtotal || ""),
    iva: String(c.iva_trasladado || ""),
    ieps: ieps ? String(ieps) : "",
    retenciones: String(c.retenciones || ""),
    categoriaId: data.ai.categoria_id ?? "",
    notas: data.ai.notas || "",
  };
}
