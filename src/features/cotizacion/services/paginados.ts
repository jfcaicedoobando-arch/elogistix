/**
 * YG-03: listado de Cotizaciones — fetcher server-side (búsqueda, filtros,
 * orden y paginación resueltos en SQL en lugar de traer hasta CAP_POSTGREST
 * filas y filtrar en memoria).
 */
import { supabase } from "@/integrations/supabase/client";
import { orIlike } from "@/lib/search/ilike";
import { ESTADOS_INACTIVOS } from "@/features/cotizacion/domain/lifecycle";
import { COTIZACION_LIST_COLUMNS, flattenCotizacionListRow } from "./queries";
import type { CotizacionListItem, SegmentoCotizacion } from "./cotizacionListTypes";

/** Whitelist de columnas ordenables (evita inyección vía `sort`). */
export const SORTABLE_COTIZACION_COLUMNS = [
  "created_at", "folio", "cliente_nombre", "subtotal", "estado",
] as const;
export type SortableCotizacionColumn = typeof SORTABLE_COTIZACION_COLUMNS[number];

/** Mapea el id de columna del `<DataTable>` a la columna real de la BD. */
export const SORT_KEY_TO_COLUMN: Record<string, SortableCotizacionColumn> = {
  folio: "folio",
  cliente: "cliente_nombre",
  subtotal: "subtotal",
  estado_vigencia: "estado",
  fecha: "created_at",
};

export interface CotizacionesFiltrosSql {
  organizationId: string | null;
  search: string;
  filterEstado: string;
  filterCliente: string;
  filterSinCostos: boolean;
  incluirInactivas: boolean;
  soloAceptadasSinEmbarque: boolean;
  segmento: SegmentoCotizacion;
}

export interface CotizacionesPaginadasParams extends CotizacionesFiltrosSql {
  page: number;
  pageSize: number;
  sortKey?: string | null;
  sortDir?: "asc" | "desc";
}

export interface CotizacionesPaginadasResult {
  rows: CotizacionListItem[];
  count: number;
}

interface FiltrableQuery {
  is(col: string, val: null): FiltrableQuery;
  eq(col: string, val: unknown): FiltrableQuery;
  in(col: string, vals: readonly string[]): FiltrableQuery;
  or(expr: string): FiltrableQuery;
  not(col: string, op: string, val: unknown): FiltrableQuery;
}

/** Aplica los filtros comunes a búsqueda, segmento, estado y bandejas. */
export function aplicarFiltrosCotizaciones<T extends FiltrableQuery>(
  query: T,
  f: CotizacionesFiltrosSql,
): T {
  let q = query.is("deleted_at", null);
  if (f.organizationId) q = q.eq("organization_id", f.organizationId) as T;

  if (f.search.trim()) {
    q = q.or(orIlike(["folio", "cliente_nombre", "descripcion_mercancia"], f.search)) as T;
  }
  if (f.filterEstado !== "todos") q = q.eq("estado", f.filterEstado) as T;
  if (f.filterCliente !== "todos") q = q.eq("cliente_id", f.filterCliente) as T;

  if (f.segmento === "prospectos") q = q.eq("es_prospecto", true) as T;
  else if (f.segmento === "clientes") q = q.or("es_prospecto.is.null,es_prospecto.eq.false") as T;

  if (f.soloAceptadasSinEmbarque) {
    q = q.eq("estado", "Aceptada") as T;
    q = q.is("embarque_id", null) as T;
  }

  if (!f.incluirInactivas) {
    const estadoExplicito = f.filterEstado !== "todos" && (ESTADOS_INACTIVOS as readonly string[]).includes(f.filterEstado);
    if (!estadoExplicito) {
      q = q.not("estado", "in", `(${ESTADOS_INACTIVOS.join(",")})`) as T;
    }
  }

  // YG-03: "Sin costos" = flag `sin_desglose_costos` Y cero filas en
  // `cotizacion_costos`. Se resuelve 100% en el servidor filtrando por el
  // recurso embebido (`cotizacion_costos=is.null`, left join de PostgREST),
  // por lo que el conteo exacto y la paginación siguen siendo de la base.
  // Antes se pre-resolvían los ids con dos consultas topadas a 1000 filas.
  if (f.filterSinCostos) {
    q = q.eq("sin_desglose_costos", true) as T;
    q = q.is("cotizacion_costos", null) as T;
  }

  return q as T;
}

export async function fetchCotizacionesPaginadas(
  p: CotizacionesPaginadasParams,
): Promise<CotizacionesPaginadasResult> {
  const sortColumn = SORTABLE_COTIZACION_COLUMNS.includes(
    SORT_KEY_TO_COLUMN[p.sortKey ?? ""] as SortableCotizacionColumn,
  )
    ? SORT_KEY_TO_COLUMN[p.sortKey ?? "fecha"]
    : "created_at";

  let query = supabase
    .from("cotizaciones") // SOFT-DELETE-OK: el filtro vive en `aplicarFiltrosCotizaciones`.
    // SAFE-CAST: se estrecha el builder de supabase-js a la interfaz mínima
    // (filtros + order + range) para poder compartir `aplicarFiltrosCotizaciones`.
    .select(COTIZACION_LIST_COLUMNS, { count: "exact" }) as unknown as FiltrableQuery & {
      order: (col: string, opts: { ascending: boolean }) => typeof query;
      range: (from: number, to: number) => Promise<{ data: unknown; count: number | null; error: unknown }>;
    };

  query = aplicarFiltrosCotizaciones(query, p) as typeof query;

  const from = p.page * p.pageSize;
  const to = from + p.pageSize - 1;
  const { data, count, error } = await query
    .order(sortColumn, { ascending: p.sortDir === "asc" })
    .range(from, to);
  if (error) throw error;

  return { rows: flattenCotizacionListRow(data), count: count ?? 0 };
}

// ─── Exportación completa (CSV) ─────────────────────────────────────────────
/** Tamaño de lote al traer TODO el resultado filtrado para exportar a CSV. */
export const EXPORT_BATCH_SIZE = 1000;

/**
 * Trae todas las filas que matchean los filtros actuales, iterando en lotes
 * de `EXPORT_BATCH_SIZE` (PostgREST no permite `.range()` sin tope superior).
 * Usado por `useCotizacionActions.exportar` — el CSV debe incluir TODO el
 * resultado filtrado, no sólo la página visible en pantalla.
 */
export async function fetchTodasCotizacionesParaExportar(
  filtros: CotizacionesFiltrosSql,
  sortKey?: string | null,
  sortDir?: "asc" | "desc",
): Promise<CotizacionListItem[]> {
  const rows: CotizacionListItem[] = [];
  let page = 0;
  for (;;) {
    const { rows: batch, count } = await fetchCotizacionesPaginadas({
      ...filtros,
      page,
      pageSize: EXPORT_BATCH_SIZE,
      sortKey,
      sortDir,
    });
    rows.push(...batch);
    page += 1;
    if (batch.length === 0 || rows.length >= count) break;
  }
  return rows;
}
