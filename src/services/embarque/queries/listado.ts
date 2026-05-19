/**
 * Queries de listado de embarques.
 *
 * v8.173.0 (Ola B.4): `fetchEmbarquesPaginados` consume el RPC consolidado
 * `embarques_listado` que devuelve filas + conteos de costos/documentos +
 * total_count en una sola llamada (antes eran 2 round-trips:
 * select paginado + RPC `embarques_list_extras`).
 *
 * `fetchEmbarquesListExtras` se conserva para el flujo de export CSV y para
 * la rama con filtro de estado que sigue usando `fetchEmbarquesParaExport`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { EMBARQUE_LIST_COLUMNS } from "../columns";

type EmbarqueRow = Tables<"embarques">;


/**
 * Whitelist de columnas server-side ordenables. Evita inyección y garantiza
 * que la columna existe en `embarques`. Las claves del UI se mapean a estos
 * campos reales de DB en `SORT_KEY_TO_COLUMN`.
 */
export const SORTABLE_EMBARQUE_COLUMNS = [
  "created_at", "expediente", "cliente_nombre", "modo", "estado", "etd", "eta", "operador",
] as const;
export type SortableEmbarqueColumn = typeof SORTABLE_EMBARQUE_COLUMNS[number];

export const SORT_KEY_TO_COLUMN: Record<string, SortableEmbarqueColumn> = {
  expediente: "expediente",
  cliente: "cliente_nombre",
  modo: "modo",
  estado: "estado",
  etd: "etd",
  eta: "eta",
  operador: "operador",
  created_at: "created_at",
};

export interface EmbarquesPaginadosFilters {
  organizationId: string | null;
  search: string;
  filterModo: string;
  filterCliente: string;
  filterOperador: string;
  filterProforma?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page: number;
  pageSize: number;
  sortBy?: SortableEmbarqueColumn;
  sortDir?: "asc" | "desc";
}

export interface EmbarquesPaginadosResult {
  data: EmbarqueRow[];
  count: number;
  extras: EmbarqueListExtras;
}

export async function fetchEmbarquesPaginados(
  f: EmbarquesPaginadosFilters,
): Promise<EmbarquesPaginadosResult> {
  const sortBy: SortableEmbarqueColumn = SORTABLE_EMBARQUE_COLUMNS.includes(f.sortBy as SortableEmbarqueColumn)
    ? (f.sortBy as SortableEmbarqueColumn)
    : "created_at";
  const from = f.page * f.pageSize;

  const { data, error } = await supabase.rpc("embarques_listado", {
    p_organization_id: f.organizationId ?? undefined,
    p_search: f.search || undefined,
    p_modo: f.filterModo !== "todos" ? f.filterModo : undefined,
    p_cliente_id: f.filterCliente !== "todos" ? f.filterCliente : undefined,
    p_operador: f.filterOperador !== "todos" ? f.filterOperador : undefined,
    p_proforma:
      f.filterProforma === "con" ? "con" : f.filterProforma === "sin" ? "sin" : undefined,
    p_fecha_desde: f.fechaDesde || undefined,
    p_fecha_hasta: f.fechaHasta || undefined,
    p_sort_by: sortBy,
    p_sort_dir: f.sortDir ?? "desc",
    p_offset: from,
    p_limit: f.pageSize,
  });
  if (error) throw error;

  const rows = (data ?? []) as Array<EmbarqueRow & {
    costos_total: number | string;
    costos_pagados: number | string;
    docs_total: number | string;
    docs_pendientes: number | string;
    total_count: number | string;
  }>;

  const count = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const liquidacion: EmbarqueListExtras["liquidacion"] = {};
  const docs: EmbarqueListExtras["docs"] = {};
  const data_clean: EmbarqueRow[] = rows.map((r) => {
    liquidacion[r.id] = {
      total: Number(r.costos_total),
      pagados: Number(r.costos_pagados),
    };
    docs[r.id] = {
      total: Number(r.docs_total),
      pendientes: Number(r.docs_pendientes),
    };
    // Limpia los campos agregados del row antes de devolverlo.
    const {
      costos_total: _ct, costos_pagados: _cp,
      docs_total: _dt, docs_pendientes: _dp,
      total_count: _tc,
      ...clean
    } = r;
    return clean as EmbarqueRow;
  });

  return { data: data_clean, count, extras: { liquidacion, docs } };
}

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

  // Aplica los filtros comunes a un query base. Permite reutilizar el armado
  // tanto para el conteo (head:true) como para cada página.
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

  // 1) Conteo exacto en una sola llamada (sin traer filas).
  const countQueryBase = supabase
    .from("embarques")
    .select(EMBARQUE_LIST_COLUMNS, { count: "exact", head: true });
  const { count, error: countErr } = await applyFilters(countQueryBase);
  if (countErr) throw countErr;
  const total = (count as number | null) ?? 0;
  if (total === 0) return [];

  // 2) Disparar todas las páginas en paralelo (lineal, sin loop secuencial con await).
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

export async function fetchEmbarquesRelacionados(_embarqueId: string, blMaster: string) {
  const { data, error } = await supabase
    .from("embarques")
    .select("id, expediente, bl_house, contenedor, tipo_contenedor, peso_kg, volumen_m3, piezas, estado")
    .eq("bl_master", blMaster)
    .order("contenedor", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export interface EmbarqueListExtras {
  liquidacion: Record<string, { total: number; pagados: number }>;
  docs: Record<string, { total: number; pendientes: number }>;
}

export async function fetchEmbarquesListExtras(ids: string[]): Promise<EmbarqueListExtras> {
  if (ids.length === 0) return { liquidacion: {}, docs: {} };
  const { data, error } = await supabase.rpc("embarques_list_extras", { p_ids: ids });
  if (error) throw error;

  const liquidacion: EmbarqueListExtras["liquidacion"] = {};
  const docs: EmbarqueListExtras["docs"] = {};
  (data ?? []).forEach(
    (row: {
      embarque_id: string;
      costos_total: number;
      costos_pagados: number;
      docs_total: number;
      docs_pendientes: number;
    }) => {
      liquidacion[row.embarque_id] = {
        total: Number(row.costos_total),
        pagados: Number(row.costos_pagados),
      };
      docs[row.embarque_id] = {
        total: Number(row.docs_total),
        pendientes: Number(row.docs_pendientes),
      };
    },
  );
  return { liquidacion, docs };
}
