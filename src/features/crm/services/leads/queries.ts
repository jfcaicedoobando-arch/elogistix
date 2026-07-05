/**
 * Leads — lecturas (lista paginada y detalle).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  LEAD_COLUMNS,
  type CrmLeadRow,
  type LeadFiltros,
  type LeadsResultado,
} from "@/features/crm/domain/leads/constants";

export async function listLeads(filtros: LeadFiltros): Promise<LeadsResultado> {
  const {
    search = "",
    estado = "todos",
    fuente = "todos",
    page = 0,
    pageSize = 25,
    sortKey = "created_at",
    sortDir = "desc",
  } = filtros;

  let q = supabase
    .from("crm_leads")
    .select(LEAD_COLUMNS, { count: "exact" })
    .order(sortKey, { ascending: sortDir === "asc" });

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    q = q.or(`empresa.ilike.${term},contacto.ilike.${term},email.ilike.${term}`);
  }
  if (estado !== "todos") q = q.eq("estado", estado);
  if (fuente !== "todos") q = q.eq("fuente", fuente);

  const from = page * pageSize;
  q = q.range(from, from + pageSize - 1);

  const { data, count, error } = await q;
  if (error) throw error;
  return { data: (data ?? []) as CrmLeadRow[], count: count ?? 0 };
}

export async function getLead(id: string): Promise<CrmLeadRow | null> {
  const { data, error } = await supabase
    .from("crm_leads")
    .select(LEAD_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as CrmLeadRow | null;
}
