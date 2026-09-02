import type { Database } from "@/integrations/supabase/types";
import type { LeadIcpPatch } from "./icp";

export type CrmLeadRow = Database["public"]["Tables"]["crm_leads"]["Row"];
export type CrmLeadEstado = Database["public"]["Enums"]["crm_lead_estado"];
export type CrmLeadFuente = Database["public"]["Enums"]["crm_lead_fuente"];

/**
 * Catálogo COMPLETO de estados. Se conserva íntegro para filtros, historial y
 * visualización: un lead puede estar en cualquiera de ellos.
 */
export const LEAD_ESTADOS: CrmLeadEstado[] = [
  "Nuevo",
  "Contactado",
  "Calificado",
  // Prospecto: lead calificado al que ya se le cotiza, pero que aún no acepta nada.
  "Prospecto",
  // Pendiente de alta: aceptó una cotización; NO es cliente hasta el alta manual autorizada.
  "Pendiente de alta",
  "Descalificado",
  "Convertido",
];

/**
 * v13.823.62 — fuente ÚNICA de la separación manual vs administrado por el ERP.
 *
 * Manuales: los captura una persona (alta, seguimiento, descarte).
 * Derivados: los produce el ERP al calificar/cotizar/convertir; nadie los
 * asigna a mano (el guard `guard_crm_lead_estado_canonico` los bloquea en base).
 */
export const LEAD_ESTADOS_MANUALES: CrmLeadEstado[] = ["Nuevo", "Contactado", "Descalificado"];

export const LEAD_ESTADOS_DERIVADOS: CrmLeadEstado[] = [
  "Calificado",
  "Prospecto",
  "Pendiente de alta",
  "Convertido",
];

/** ¿El estado lo administra el ERP (no se puede asignar a mano)? */
export function esEstadoDerivado(estado: CrmLeadEstado | null | undefined): boolean {
  return estado != null && LEAD_ESTADOS_DERIVADOS.includes(estado);
}

/** Texto corto para la UI cuando el estado es administrado por el ERP. */
export const LEAD_ESTADO_DERIVADO_AYUDA = "Este estado lo actualiza el ERP";


export const LEAD_FUENTES: CrmLeadFuente[] = [
  "Web",
  "Referido",
  "Campaña",
  "Llamada en frío",
  "Evento",
  "Otro",
];

export type LeadSortKey = "created_at" | "empresa" | "estado" | "fuente" | "score";
export const LEAD_SORTABLE_KEYS = ["created_at", "empresa", "estado", "fuente", "score"] as const;

export interface LeadFiltros {
  search?: string;
  estado?: CrmLeadEstado | "todos";
  /**
   * Rediseño CRM (v13.766.0): acota el listado a una etapa del embudo
   * (leads vs prospectos). Se aplica además de `estado`.
   */
  estadoIn?: CrmLeadEstado[];
  fuente?: CrmLeadFuente | "todos";
  page?: number;
  pageSize?: number;
  sortKey?: LeadSortKey;
  sortDir?: "asc" | "desc";
}

export interface LeadsResultado {
  data: CrmLeadRow[];
  count: number;
}

export const LEAD_COLUMNS =
  "id, empresa, contacto, email, telefono, ciudad, pais, fuente, estado, score, interes_modo, vendedor_id, vendedor_email, notas, oportunidad_convertida_id, cliente_convertido_id, created_at, updated_at, sector, sitio_web, anios_establecida, mercancia, rutas, aduana_puerto, incoterm, volumen, frecuencia, dolor_explicito, consecuencia, proveedor_actual, estatus_icp, motivo_nutricion, fecha_nutricion, cargo_contacto, origen, destino";

export type LeadInput = {
  empresa: string;
  contacto?: string;
  email?: string;
  telefono?: string;
  ciudad?: string;
  pais?: string;
  fuente?: CrmLeadFuente;
  estado?: CrmLeadEstado;
  score?: number;
  interes_modo?: string;
  notas?: string;
  vendedor_id?: string | null;
  vendedor_email?: string;
} & Partial<LeadIcpPatch>;
