import type { Database } from "@/integrations/supabase/types";

export type CrmLeadRow = Database["public"]["Tables"]["crm_leads"]["Row"];
export type CrmLeadEstado = Database["public"]["Enums"]["crm_lead_estado"];
export type CrmLeadFuente = Database["public"]["Enums"]["crm_lead_fuente"];

export const LEAD_ESTADOS: CrmLeadEstado[] = [
  "Nuevo",
  "Contactado",
  "Calificado",
  "Descalificado",
  "Convertido",
];

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
  "id, empresa, contacto, email, telefono, ciudad, pais, fuente, estado, score, interes_modo, vendedor_id, vendedor_email, notas, oportunidad_convertida_id, cliente_convertido_id, created_at, updated_at";

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
};
