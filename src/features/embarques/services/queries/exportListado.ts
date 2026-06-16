import type { Tables } from "@/integrations/supabase/types";
import { fetchEmbarquesPaginados, type EmbarquesPaginadosFilters } from "./paginados";
import { embarqueListRowsSchema } from "./embarqueRowSchema";

type EmbarqueRow = Tables<"embarques">;

/**
 * Trae TODOS los embarques que cumplen los filtros (sin paginar), iterando
 * la RPC `embarques_listado` en chunks de 1000 vía `fetchEmbarquesPaginados`.
 *
 * Refactor 12.16.5 — antes existía una implementación paralela con builders
 * PostgREST y `applyFilters` propio. Reusar `fetchEmbarquesPaginados` evita
 * que los filtros de UI y los filtros de export diverjan silenciosamente.
 */
export type EmbarquesParaExportFilters = Omit<
  EmbarquesPaginadosFilters,
  "page" | "pageSize" | "sortBy" | "sortDir"
>;

const EXPORT_PAGE = 1000;

export async function fetchEmbarquesParaExport(
  f: EmbarquesParaExportFilters,
): Promise<EmbarqueRow[]> {
  const out: EmbarqueRow[] = [];
  let page = 0;
  let total = Infinity;

  while (page * EXPORT_PAGE < total) {
    const { data, count } = await fetchEmbarquesPaginados({
      ...f,
      page,
      pageSize: EXPORT_PAGE,
      sortBy: "expediente_num",
      sortDir: "desc",
    });
    total = count;
    // Validación runtime: schema con .passthrough() detecta cambios de shape
    // antes de generar un CSV corrupto.
    embarqueListRowsSchema.parse(data);
    out.push(...data);
    if (data.length < EXPORT_PAGE) break;
    page++;
  }
  return out;
}
