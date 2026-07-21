/**
 * Helpers puros para la página de listado de embarques.
 * Extraídos de `useEmbarquesPageState` (11.14.0).
 */
import type { EmbarqueRow } from "@/features/embarques/types/embarque";

export interface EmbarqueListExtras {
  liquidacion: Record<string, { total: number; pagados: number }>;
  docs: Record<string, { total: number; pendientes: number }>;
}

export type SortDir = "asc" | "desc";

/** Extrae el consecutivo numérico del expediente ignorando prefijo (ELNAC, ELIMP, DEMO-…). */
export function expedienteConsecutivo(expediente: string | null | undefined): number {
  if (!expediente) return 0;
  const digits = expediente.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

export const SORT_GETTERS: Record<string, (e: EmbarqueRow) => string | number> = {
  expediente: (e) => expedienteConsecutivo(e.expediente),
  cliente: (e) => e.cliente_nombre ?? "",
  modo: (e) => e.modo ?? "",
  estado: (e) => e.estado ?? "",
  etd: (e) => e.etd ?? "",
  eta: (e) => e.eta ?? "",
  operador: (e) => e.operador ?? "",
  created_at: (e) => e.created_at ?? "",
};

export function compareBy(
  a: EmbarqueRow,
  b: EmbarqueRow,
  sortKey: string | null,
  dir: SortDir,
): number {
  const mult = dir === "asc" ? 1 : -1;
  const getVal = SORT_GETTERS[sortKey ?? "expediente"] ?? SORT_GETTERS.expediente;
  const va = getVal(a);
  const vb = getVal(b);
  if (va < vb) return -1 * mult;
  if (va > vb) return 1 * mult;
  return 0;
}

export interface CountsInput {
  estadoFilterActivo: boolean;
  dedupedAll: EmbarqueRow[];
  containersForView: EmbarqueRow[];
  sortedAll: EmbarqueRow[];
  pageSize: number;
  totalCountServer: number;
}

export function computeCounts(i: CountsInput) {
  const sourceForPages = i.estadoFilterActivo ? i.sortedAll.length : i.totalCountServer;
  return {
    totalCountServer: i.totalCountServer,
    expedientesCount: i.estadoFilterActivo ? i.dedupedAll.length : i.totalCountServer,
    contenedoresCount: i.estadoFilterActivo
      ? i.containersForView.length
      : i.totalCountServer,
    totalPages: Math.max(1, Math.ceil(sourceForPages / i.pageSize)),
  };
}

export function resolveExtras(
  estadoActivo: boolean,
  branchB: EmbarqueListExtras | undefined,
  branchA: EmbarqueListExtras | undefined,
): EmbarqueListExtras {
  const empty: EmbarqueListExtras = { liquidacion: {}, docs: {} };
  return (estadoActivo ? branchB : branchA) ?? empty;
}

export function buildFullSetFilters(i: {
  organizationId: string | null | undefined;
  search: string | null;
  filterModo: string;
  filterCliente: string;
  filterOperador: string;
  fechaDesde: string;
  fechaHasta: string;
}) {
  return {
    organizationId: i.organizationId ?? null,
    search: i.search ?? "",
    filterModo: i.filterModo,
    filterCliente: i.filterCliente,
    filterOperador: i.filterOperador,
    fechaDesde: i.fechaDesde || undefined,
    fechaHasta: i.fechaHasta || undefined,
  };
}

export function dedupePorExpediente(rows: EmbarqueRow[]): EmbarqueRow[] {
  const seen = new Set<string>();
  const out: EmbarqueRow[] = [];
  for (const e of rows) {
    const key = e.expediente ?? e.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export function contenedoresPorExpediente(rows: EmbarqueRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of rows) {
    if (!e.expediente) continue;
    map[e.expediente] = (map[e.expediente] ?? 0) + 1;
  }
  return map;
}

import { calcularEstadoEmbarque } from "@/features/embarques/hooks/useEmbarques";

interface ApplyClientFiltersArgs {
  estadoFilterActivo: boolean;
  alertaFilterActivo: boolean;
  alertIdSet: Set<string> | null;
  filterEstado: string;
}

export function applyClientFilters(rows: EmbarqueRow[], args: ApplyClientFiltersArgs): EmbarqueRow[] {
  const { estadoFilterActivo, alertaFilterActivo, alertIdSet, filterEstado } = args;
  let all = rows;
  if (estadoFilterActivo) {
    all = all.filter(
      (e) => calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado, e.fecha_llegada_real) === filterEstado,
    );
  }
  if (alertaFilterActivo && alertIdSet) {
    all = all.filter((e) => alertIdSet.has(e.id));
  }
  return all;
}

interface SinFiltrosArgs {
  debouncedSearch: string;
  filterModo: string;
  filterEstado: string;
  filterCliente: string;
  filterOperador: string;
  filterAlerta: string;
  fechaDesde: string;
  fechaHasta: string;
}

export function computeSinFiltros(a: SinFiltrosArgs): boolean {
  return (
    !a.debouncedSearch &&
    [a.filterModo, a.filterEstado, a.filterCliente, a.filterOperador].every((v) => v === "todos") &&
    a.filterAlerta === "todos" &&
    !a.fechaDesde &&
    !a.fechaHasta
  );
}
