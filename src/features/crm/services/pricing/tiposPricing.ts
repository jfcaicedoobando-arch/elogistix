/**
 * Catálogos y tipos de la Solicitud a Pricing (CRM Fase 5).
 * Los valores deben coincidir con los CHECK de `crm_solicitudes_pricing`
 * y `crm_pricing_opciones`.
 */
import type { Database } from "@/integrations/supabase/types";

export type SolicitudPricingRow = Database["public"]["Tables"]["crm_solicitudes_pricing"]["Row"];
export type SolicitudPricingInsert = Database["public"]["Tables"]["crm_solicitudes_pricing"]["Insert"];
export type OpcionPricingRow = Database["public"]["Tables"]["crm_pricing_opciones"]["Row"];
export type OpcionPricingInsert = Database["public"]["Tables"]["crm_pricing_opciones"]["Insert"];

export const SERVICIOS_PRICING = ["Marítimo", "Terrestre", "Aéreo"] as const;
export const INCOTERMS_PRICING = ["EXW", "FAS", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP", "DPU"] as const;
export const MONEDAS_PRICING = ["USD", "MXN", "EUR"] as const;
export const UNIDADES_MEDIDA_PRICING = [
  { value: "kg", label: "Kilogramos (kg)" },
  { value: "lb", label: "Libras (lb)" },
  { value: "t", label: "Toneladas (t)" },
  { value: "g", label: "Gramos (g)" },
] as const;
export type ComplejidadPricing = "baja" | "media" | "alta";

export const HORAS_POR_COMPLEJIDAD: Record<ComplejidadPricing, number> = { baja: 8, media: 24, alta: 48 };
export const ETIQUETA_COMPLEJIDAD: Record<ComplejidadPricing, string> = {
  baja: "Baja (8 h)", media: "Media (24 h)", alta: "Alta (48 h)",
};
export const ETIQUETA_ESTADO_PRICING: Record<string, string> = {
  borrador: "Borrador", enviada: "Enviada", respondida: "Respondida", cancelada: "Cancelada",
};

/** Los 4 cargos que captura Pricing; cada uno con tarifa, moneda y unidad. */
export const CARGOS_PRICING = [
  { clave: "of", etiqueta: "Flete (OF)" },
  { clave: "origen", etiqueta: "Cargos en origen" },
  { clave: "recoleccion", etiqueta: "Recolección" },
  { clave: "otros", etiqueta: "Otros" },
] as const;
export type ClaveCargo = (typeof CARGOS_PRICING)[number]["clave"];

/** Campos editables de una opción (sin llaves ni auditoría). */
export type OpcionPricingForm = Omit<
  OpcionPricingInsert,
  "id" | "organization_id" | "solicitud_id" | "created_at" | "updated_at" | "created_by"
>;

export const OPCION_VACIA: OpcionPricingForm = {
  agente: "", naviera_id: null, carta_garantia: null, transito: "", ruta: "", tarifa_id: null,
  of_tarifa: null, of_moneda: "USD", of_unidad: "",
  origen_tarifa: null, origen_moneda: "USD", origen_unidad: "",
  recoleccion_tarifa: null, recoleccion_moneda: "MXN", recoleccion_unidad: "",
  otros_concepto: "", otros_tarifa: null, otros_moneda: "USD", otros_unidad: "",
};

/** Mensajes en español para los códigos LC_PRICING_* de la base. */
export function mensajeErrorPricing(err: unknown): string {
  const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? "");
  const mapa: Record<string, string> = {
    LC_PRICING_INCOMPLETA: "Falta el servicio, el origen o el destino.",
    LC_PRICING_SIN_OPCIONES: "Agrega al menos una opción antes de responder.",
    LC_PRICING_SIN_PERMISO: "Solo Pricing o el solicitante pueden hacer esto.",
    LC_PRICING_NO_EDITABLE: "La solicitud ya no acepta cambios en opciones.",
    LC_PRICING_ESTADO_INVALIDO: "La solicitud ya cambió de estado. Recarga la página.",
    LC_PRICING_SOLICITANTE_INVALIDO: "El solicitante no pertenece a la empresa.",
  };
  const clave = Object.keys(mapa).find((k) => msg.includes(k));
  return clave ? mapa[clave] : "No se pudo completar la acción.";
}

/** Convierte texto de input numérico a número o null (sin NaN). */
export function aNumero(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Mismo criterio que la RPC de envío: servicio + origen/POL + destino/POD. */
export function solicitudCompleta(d: {
  servicio?: string | null; origen?: string | null; pol?: string | null; destino?: string | null; pod?: string | null;
}): boolean {
  return !!d.servicio && !!(d.origen?.trim() || d.pol?.trim()) && !!(d.destino?.trim() || d.pod?.trim());
}
