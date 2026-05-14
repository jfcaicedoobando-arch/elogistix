/**
 * Queries de listado de embarques: lista completa (dashboard), paginada,
 * para export, embarques relacionados (mismo BL Master) y extras agregados
 * (liquidación + docs) vía RPC.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { EMBARQUE_LIST_COLUMNS } from "../columns";

type EmbarqueRow = Tables<"embarques">;

export async function fetchEmbarques(organizationId: string | null): Promise<EmbarqueRow[]> {
  let query = supabase
    .from("embarques")
    .select(EMBARQUE_LIST_COLUMNS)
    .order("created_at", { ascending: false });
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as EmbarqueRow[];
}

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
  filterProforma: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page: number;
  pageSize: number;
  sortBy?: SortableEmbarqueColumn;
  sortDir?: "asc" | "desc";
}

export async function fetchEmbarquesPaginados(
  f: EmbarquesPaginadosFilters,
): Promise<{ data: EmbarqueRow[]; count: number }> {
  const sortCol: SortableEmbarqueColumn = SORTABLE_EMBARQUE_COLUMNS.includes(f.sortBy as SortableEmbarqueColumn)
    ? (f.sortBy as SortableEmbarqueColumn)
    : "created_at";
  const ascending = f.sortDir === "asc";

  let query = supabase
    .from("embarques")
    .select(EMBARQUE_LIST_COLUMNS, { count: "estimated" })
    .order(sortCol, { ascending, nullsFirst: false });

  // Tiebreaker estable cuando el orden principal puede repetirse
  // (p.ej. expediente duplicado en LCL: un registro por contenedor).
  if (sortCol !== "created_at") {
    query = query.order("created_at", { ascending: false });
  }

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

  const from = f.page * f.pageSize;
  const to = from + f.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as EmbarqueRow[], count: count ?? 0 };
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
