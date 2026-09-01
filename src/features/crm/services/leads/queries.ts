/**
 * Leads — lecturas (lista paginada y detalle).
 */
import { supabase } from "@/integrations/supabase/client";
import { orIlike } from "@/lib/search/ilike";
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
    .is("deleted_at", null)
    .order(sortKey, { ascending: sortDir === "asc" })
    // EC-02: desempate estable para paginación (importaciones por lote
    // comparten `created_at`).
    .order("id", { ascending: sortDir === "asc" });


  if (search.trim()) {
    q = q.or(orIlike(["empresa", "contacto", "email"], search));
  }
  if (filtros.estadoIn && filtros.estadoIn.length > 0) q = q.in("estado", filtros.estadoIn);
  if (estado !== "todos") q = q.eq("estado", estado);
  if (fuente !== "todos") q = q.eq("fuente", fuente);

  const from = page * pageSize;
  q = q.range(from, from + pageSize - 1);

  const { data, count, error } = await q;
  if (error) throw error;
  return { data: (data ?? []) as CrmLeadRow[], count: count ?? 0 };
}

export async function getLead(id: string): Promise<CrmLeadRow | null> {
  // Un lead eliminado (soft-delete) no debe resolver su detalle aunque se
  // conserve el UUID en la URL: la ruta trata `null` como "no encontrado".
  const { data, error } = await supabase
    .from("crm_leads")
    .select(LEAD_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as CrmLeadRow | null;
}
