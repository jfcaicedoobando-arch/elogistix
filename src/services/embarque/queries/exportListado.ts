import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { EMBARQUE_LIST_COLUMNS } from "../../columns";
import type { EmbarquesPaginadosFilters } from "./paginados";

type EmbarqueRow = Tables<"embarques">;

/**
 * Trae TODOS los embarques que cumplen los filtros (sin paginar).
 * Usa paginación interna en chunks de 1000 para superar el límite default de Supabase.
 * Pensado para exportar a CSV el resultado completo del filtro actual.
 */
export type EmbarquesParaExportFilters = Omit<EmbarquesPaginadosFilters, "page" | "pageSize" | "sortBy" | "sortDir">;

export async function fetchEmbarquesParaExport(
  f: EmbarquesParaExportFilters,
): Promise<EmbarqueRow[]> {
  const PAGE = 1000;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (q: any): any => {
    let query = q;
    if (f.organizationId) query = query.eq("organization_id", f.organizationId);
    if (f.search) {
      query = query.or(
        `expediente.ilike.%${f.search}%,cliente_nombre.ilike.%${f.search}%,descripcion_mercancia.ilike.%${f.search}%,bl_master.ilike.%${f.search}%`,
      );
    }
    if (f.filterModo !== "todos") {
      query = query.eq("modo", f.filterModo as TablesInsert<"embarques">["modo"]);
    }
    if (f.filterCliente !== "todos") query = query.eq("cliente_id", f.filterCliente);
    if (f.filterOperador !== "todos") query = query.eq("operador", f.filterOperador);
    if (f.filterProforma === "con") query = query.eq("tiene_proforma", true);
    else if (f.filterProforma === "sin") query = query.eq("tiene_proforma", false);
    if (f.fechaDesde) query = query.gte("etd", f.fechaDesde);
    if (f.fechaHasta) query = query.lte("eta", f.fechaHasta);
    return query;
  };

  const countQueryBase = supabase
    .from("embarques")
    .select(EMBARQUE_LIST_COLUMNS, { count: "exact", head: true });
  const { count, error: countErr } = await applyFilters(countQueryBase);
  if (countErr) throw countErr;
  const total = (count as number | null) ?? 0;
  if (total === 0) return [];

  const pageCount = Math.ceil(total / PAGE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, async (_, i) => {
      const from = i * PAGE;
      const to = Math.min(from + PAGE - 1, total - 1);
      const base = supabase
        .from("embarques")
        .select(EMBARQUE_LIST_COLUMNS)
        .order("created_at", { ascending: false })
        .range(from, to);
      const { data, error } = await applyFilters(base);
      if (error) throw error;
      return (data ?? []) as EmbarqueRow[];
    }),
  );
  return pages.flat();
}
