/**
 * Helpers puros para `useNuevaFacturaProveedorForm`.
 * Extraídos para mantener el hook controller ≤200 líneas (Power-of-10).
 * Sin React, sin Supabase: testeables en aislamiento.
 */
import type { Database } from "@/integrations/supabase/types";
import type { FacturaFormValues } from "@/features/cxp/types";
import { todayLocalISO } from "@/lib/date/today";
import { isoUtcDay } from "@/lib/date/mx";
import { facturaFormErrorsFromZod } from "./useNuevaFacturaProveedorForm.schema";
import { roundMoney } from "@/lib/financial/financialUtils";

export type Moneda = Database["public"]["Enums"]["moneda"];

export type OrigenCarga = "manual" | "cfdi" | "pdf_ia";

export interface PendingCfdi {
  uuid: string;
  rfcEmisor: string;
  xmlFile: File | null;
  pdfFile: File | null;
  origen: Exclude<OrigenCarga, "manual">;
  /** Nombre del emisor tal como lo leyó la IA en el PDF (para aprender alias). */
  nombreEmisorDetectado?: string;
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
  // v13.303.75 · TZ-safe: aritmética con `Date.UTC` para evitar que
  // `toISOString()` reste un día en zonas al oeste de UTC (America/Mexico_City).
  // Antes: `new Date(iso+"T00:00:00")` era local, `toISOString()` lo pasaba a
  // UTC → `vencimiento` salía un día antes en México.
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(utc.getTime())) return "";
  // La regex acepta "2026-13-40"; validamos que Date no haya rodado el mes/día.
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) return "";
  utc.setUTCDate(utc.getUTCDate() + days);
  return isoUtcDay(utc);
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
  // BL-11: redondeo a centavos para que el total capturado coincida con el que
  // recalcula la base (evita descuadres de 0.004 al comparar contra pagos).
  return roundMoney(s + i + e - r);
}

/**
 * PR-6 · Ítem 3.3 (auditoría-4): delegado a zod para unificar el paradigma
 * de validación. La firma pública se preserva para no romper consumidores.
 */
export function validateFactura(
  values: FacturaFormValues,
  total: number,
): Partial<Record<keyof FacturaFormValues, string>> {
  return facturaFormErrorsFromZod(values, { total });
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
  /** v13.820.5 — Embarque de origen (buzón CxP) cuando la captura no marcó vínculos. */
  embarqueOrigenId?: string | null;
}

export function buildPayload({ values, total, userId, pendingCfdi, vinculos, embarqueOrigenId }: BuildPayloadParams) {
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
    embarque_id: embarqueIdUnico(vinculos) ?? embarqueOrigenId ?? null,
    origen_carga: (pendingCfdi?.origen ?? "manual") as OrigenCarga,
  };
}

export function mapCfdiToValues(
  data: { cfdi: { moneda: string; serie: string | null; folio: string | null; uuid: string; fecha: string; tipo_cambio: number | null; subtotal: number; iva_trasladado: number; ieps_trasladado?: number; retenciones: number }; ai: { categoria_id: string | null; notas: string | null } },
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
    tc: monedaValida === "MXN" ? "" : String(c.tipo_cambio ?? ""),
    subtotal: String(c.subtotal || ""),
    iva: String(c.iva_trasladado || ""),
    ieps: ieps ? String(ieps) : "",
    retenciones: String(c.retenciones || ""),
    categoriaId: data.ai.categoria_id ?? "",
    notas: data.ai.notas || "",
  };
}

/**
 * Aplica el proveedor elegido a los valores del formulario: hereda sus días de
 * crédito (si trae > 0) y recalcula el vencimiento. Extraído del hook
 * controller (v13.343.0) para respetar el techo de 200 líneas.
 */
export function aplicarProveedorAValues(
  prev: FacturaFormValues,
  id: string,
  nombre: string,
  diasCreditoProv?: number,
): FacturaFormValues {
  const nextDias = typeof diasCreditoProv === "number" && diasCreditoProv > 0
    ? diasCreditoProv
    : prev.diasCredito;
  return {
    ...prev,
    provId: id,
    provNombre: nombre,
    diasCredito: nextDias,
    vencimiento: addDays(prev.emision, Number(nextDias) || 0),
  };
}
