import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { escapeIlike } from "@/lib/search/ilike";

type EmbarqueRow = Tables<"embarques">;

/**
 * Whitelist de columnas server-side ordenables. Evita inyección y garantiza
 * que la columna existe en `embarques`. Las claves del UI se mapean a estos
 * campos reales de DB en `SORT_KEY_TO_COLUMN`.
 */
export const SORTABLE_EMBARQUE_COLUMNS = [
  "created_at", "expediente", "expediente_num", "cliente_nombre", "modo", "estado", "etd", "eta", "operador",
] as const;
export type SortableEmbarqueColumn = typeof SORTABLE_EMBARQUE_COLUMNS[number];

// La columna visible "Expediente" se ordena por el consecutivo numérico (ignora prefijo).
export const SORT_KEY_TO_COLUMN: Record<string, SortableEmbarqueColumn> = {
  expediente: "expediente_num",
  cliente: "cliente_nombre",
  modo: "modo",
  estado: "estado",
  etd: "etd",
  eta: "eta",
  operador: "operador",
  created_at: "created_at",
};

export type { EmbarqueListExtras } from "@/features/embarques/domain/embarquesPageHelpers";
import type { EmbarqueListExtras } from "@/features/embarques/domain/embarquesPageHelpers";

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
    : "expediente_num";
  const from = f.page * f.pageSize;

  const { data, error } = await supabase.rpc("embarques_listado", {
    p_organization_id: f.organizationId ?? undefined,
    // A-4: `embarques_listado` arma el patrón `%texto%` para ILIKE; sin
    // escapar, un `%` o `_` tecleado por el usuario actúa como comodín.
    p_search: f.search ? escapeIlike(f.search) : undefined,
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
