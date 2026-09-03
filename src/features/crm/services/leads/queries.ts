/**
 * Leads — lecturas (lista paginada, lectura completa para exportar y detalle).
 */
import { supabase } from "@/integrations/supabase/client";
import { orIlike } from "@/lib/search/ilike";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";
import {
  LEAD_COLUMNS,
  type CrmLeadRow,
  type LeadFiltros,
  type LeadsResultado,
} from "@/features/crm/domain/leads/constants";

interface FiltrableBuilder<T> {
  or: (f: string) => T;
  eq: (c: string, v: string) => T;
  in: (c: string, v: readonly string[]) => T;
  order: (c: string, o: { ascending: boolean }) => T;
}

/**
 * Aplica búsqueda, etapa (`estadoIn`), estado, fuente y orden.
 *
 * Fuente ÚNICA para el listado paginado y la exportación completa: si la
 * exportación repitiera los filtros a mano acabaría divergiendo del listado.
 */
function aplicarFiltrosLeads<T extends FiltrableBuilder<T>>(builder: T, filtros: LeadFiltros): T {
  const { search = "", estado = "todos", fuente = "todos" } = filtros;
  const sortKey = filtros.sortKey ?? "created_at";
  const asc = (filtros.sortDir ?? "desc") === "asc";

  let q = builder
    .order(sortKey, { ascending: asc })
    // EC-02: desempate estable para paginación (importaciones por lote
    // comparten `created_at`).
    .order("id", { ascending: asc });

  if (search.trim()) q = q.or(orIlike(["empresa", "contacto", "email"], search));
  if (filtros.estadoIn && filtros.estadoIn.length > 0) q = q.in("estado", filtros.estadoIn);
  if (estado !== "todos") q = q.eq("estado", estado);
  if (fuente !== "todos") q = q.eq("fuente", fuente);
  return q;
}

export async function listLeads(filtros: LeadFiltros): Promise<LeadsResultado> {
  const { page = 0, pageSize = 25 } = filtros;

  const base = supabase
    .from("crm_leads")
    .select(LEAD_COLUMNS, { count: "exact" })
    .is("deleted_at", null);

  const from = page * pageSize;
  const q = aplicarFiltrosLeads(base, filtros).range(from, from + pageSize - 1);

  const { data, count, error } = await q;
  if (error) throw error;
  return { data: (data ?? []) as CrmLeadRow[], count: count ?? 0 };
}

/**
 * Lee TODAS las coincidencias de los filtros actuales (exportación CSV).
 * RLS sigue limitando lo visible; sólo se quita el corte de página.
 */
export async function listLeadsTodos(
  filtros: Omit<LeadFiltros, "page" | "pageSize">,
): Promise<CrmLeadRow[]> {
  return leerTodasLasPaginas<CrmLeadRow>("crm.leads.export", (desde, hasta) =>
    aplicarFiltrosLeads(
      supabase.from("crm_leads").select(LEAD_COLUMNS).is("deleted_at", null),
      filtros,
    // SAFE-CAST: el builder de Supabase es thenable con la forma { data, error }; el tipo generado no lo expresa.
    ).range(desde, hasta) as unknown as PromiseLike<{
      data: CrmLeadRow[] | null;
      error: { message: string } | null;
    }>,
  );
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
