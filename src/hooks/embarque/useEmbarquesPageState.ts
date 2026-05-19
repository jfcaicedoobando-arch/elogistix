/**
 * Estado y filtros de la página de listado de Embarques.
 *
 * v8.153.2 — Cuando hay filtro por estado, se trae el set COMPLETO (sin paginar
 * server-side) porque el estado real se calcula client-side a partir de
 * etd/eta/estado. Sobre ese set se filtra, se agrupa por expediente, se
 * ordena y se pagina. Esto garantiza que:
 *  - Los conteos del dashboard (contenedores) cuadren con el listado.
 *  - El expediente no "desaparezca" al cambiar el tamaño de página.
 *
 * Sin filtro de estado se mantiene la paginación server-side original.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEmbarquesPaginados, calcularEstadoEmbarque } from "@/hooks/embarque/useEmbarques";
import type { EmbarqueRow } from "@/hooks/embarque/useEmbarques";
import type { SortableEmbarqueColumn } from "@/services/embarque/queries";
import { SORT_KEY_TO_COLUMN } from "@/services/embarque/queries";
import { fetchEmbarquesParaExport, fetchEmbarquesListExtras } from "@/services/embarque";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { queryKeys } from "@/lib/query";
import { useEmbarquesFilters, type SortDir } from "@/hooks/embarque/useEmbarquesFilters";

export type { SortDir };

const SORT_GETTERS: Record<string, (e: EmbarqueRow) => string> = {
  expediente: (e) => e.expediente ?? "",
  cliente: (e) => e.cliente_nombre ?? "",
  modo: (e) => e.modo ?? "",
  estado: (e) => e.estado ?? "",
  etd: (e) => e.etd ?? "",
  eta: (e) => e.eta ?? "",
  operador: (e) => e.operador ?? "",
  created_at: (e) => e.created_at ?? "",
};

function compareBy(a: EmbarqueRow, b: EmbarqueRow, sortKey: string | null, dir: SortDir): number {
  const mult = dir === "asc" ? 1 : -1;
  const getVal = SORT_GETTERS[sortKey ?? "expediente"] ?? SORT_GETTERS.expediente;
  const va = getVal(a);
  const vb = getVal(b);
  if (va < vb) return -1 * mult;
  if (va > vb) return 1 * mult;
  return 0;
}

interface CountsInput {
  estadoFilterActivo: boolean;
  dedupedAll: EmbarqueRow[];
  containersForView: EmbarqueRow[];
  sortedAll: EmbarqueRow[];
  pageSize: number;
  totalCountServer: number;
}
function computeCounts(i: CountsInput) {
  const sourceForPages = i.estadoFilterActivo ? i.sortedAll.length : i.totalCountServer;
  return {
    totalCountServer: i.totalCountServer,
    expedientesCount: i.estadoFilterActivo ? i.dedupedAll.length : i.totalCountServer,
    contenedoresCount: i.estadoFilterActivo ? i.containersForView.length : i.totalCountServer,
    totalPages: Math.max(1, Math.ceil(sourceForPages / i.pageSize)),
  };
}

import type { EmbarqueListExtras } from "@/services/embarque/queries";
function resolveExtras(
  estadoActivo: boolean,
  branchB: EmbarqueListExtras | undefined,
  branchA: EmbarqueListExtras | undefined,
): EmbarqueListExtras {
  const empty: EmbarqueListExtras = { liquidacion: {}, docs: {} };
  return (estadoActivo ? branchB : branchA) ?? empty;
}

function buildFullSetFilters(i: {
  organizationId: string | null | undefined;
  search: string | null;
  filterModo: string; filterCliente: string; filterOperador: string;
  fechaDesde: string; fechaHasta: string;
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


export function useEmbarquesPageState() {
  const { organizationId } = useOrgFilter();
  const {
    search, debouncedSearch, filters, page, pageSize, sortKey, sortDir,
    DEFAULT_PAGE_SIZE, setSearch, setFilter,
    setPageRaw, setPageSizeRaw, setSortKeyRaw, setSortDirRaw,
  } = useEmbarquesFilters();

  const { modo: filterModo, estado: filterEstado, cliente: filterCliente,
    operador: filterOperador,
    fechaDesde, fechaHasta } = filters;


  const estadoFilterActivo = filterEstado !== "todos";

  const sortBy: SortableEmbarqueColumn | undefined = sortKey ? SORT_KEY_TO_COLUMN[sortKey] : undefined;

  // ---------- Rama A: sin filtro de estado → paginación server-side ----------
  const { data: resultadoServer, isLoading: loadingServer } = useEmbarquesPaginados({
    search: debouncedSearch,
    filterModo,
    filterEstado: "todos",
    filterCliente,
    filterOperador,
    page,

    pageSize,
    fechaDesde,
    fechaHasta,
    sortBy,
    sortDir: sortBy ? sortDir : undefined,
  });

  // ---------- Rama B: con filtro de estado → fetch completo + filtrado client ----------
  const fullSetFilters = buildFullSetFilters({
    organizationId,
    search: debouncedSearch,
    filterModo, filterCliente, filterOperador,

    fechaDesde, fechaHasta,
  });
  const { data: resultadoFull, isLoading: loadingFull } = useQuery({
    queryKey: [...queryKeys.embarques.all, "full-for-estado-filter", fullSetFilters],
    queryFn: () => fetchEmbarquesParaExport(fullSetFilters),
    enabled: estadoFilterActivo,
    staleTime: 60_000,
  });

  const isLoading = estadoFilterActivo ? loadingFull : loadingServer;

  // Set de contenedores que alimenta los conteos y la paginación visual.
  const containersForView: EmbarqueRow[] = useMemo(() => {
    if (!estadoFilterActivo) return resultadoServer?.data ?? [];
    const all = resultadoFull ?? [];
    return all.filter(
      (e) => calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado) === filterEstado,
    );
  }, [estadoFilterActivo, resultadoServer, resultadoFull, filterEstado]);

  // Conteo de contenedores por expediente sobre el set visible/filtrado.
  const contenedoresPorExpediente = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of containersForView) {
      if (!e.expediente) continue;
      map[e.expediente] = (map[e.expediente] ?? 0) + 1;
    }
    return map;
  }, [containersForView]);

  // Dedupe a una fila por expediente (mantiene primer registro).
  const dedupedAll = useMemo(() => {
    const seen = new Set<string>();
    const out: EmbarqueRow[] = [];
    for (const e of containersForView) {
      const key = e.expediente ?? e.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
    return out;
  }, [containersForView]);

  // Orden + paginación: client-side cuando hay filtro de estado (porque el set
  // completo ya vive en memoria); server-side en el caso por defecto.
  const sortedAll = useMemo(() => {
    if (!estadoFilterActivo) return dedupedAll;
    return [...dedupedAll].sort((a, b) => compareBy(a, b, sortKey, sortDir));
  }, [estadoFilterActivo, dedupedAll, sortKey, sortDir]);

  const counts = computeCounts({
    estadoFilterActivo,
    dedupedAll,
    containersForView,
    sortedAll,
    pageSize,
    totalCountServer: resultadoServer?.count ?? 0,
  });
  const { expedientesCount, contenedoresCount, totalPages, totalCountServer } = counts;

  // Filas visibles en la página actual.
  const filtered = useMemo(() => {
    if (!estadoFilterActivo) return dedupedAll;
    const from = page * pageSize;
    return sortedAll.slice(from, from + pageSize);
  }, [estadoFilterActivo, dedupedAll, sortedAll, page, pageSize]);

  const embarques: EmbarqueRow[] = useMemo(
    () => (estadoFilterActivo ? filtered : (resultadoServer?.data ?? [])),
    [estadoFilterActivo, filtered, resultadoServer?.data],
  );

  // ---------- Extras (liquidación + docs) ----------
  const visibleIds = useMemo(() => embarques.map((e) => e.id), [embarques]);
  const { data: extrasBranchB } = useQuery({
    queryKey: [...queryKeys.embarques.all, "extras-branch-b", visibleIds],
    queryFn: () => fetchEmbarquesListExtras(visibleIds),
    enabled: estadoFilterActivo && visibleIds.length > 0,
    staleTime: 30_000,
  });
  const extras = resolveExtras(estadoFilterActivo, extrasBranchB, resultadoServer?.extras);

  const displayCount = expedientesCount;

  const sinFiltros =
    !debouncedSearch &&
    [filterModo, filterEstado, filterCliente, filterOperador].every(
      (v) => v === "todos",
    ) &&
    !fechaDesde &&
    !fechaHasta;
  const isEmptyState = !isLoading && containersForView.length === 0 && sinFiltros;

  return {
    // values
    search,
    filterModo, filterEstado, filterCliente, filterOperador,
    fechaDesde, fechaHasta, page, pageSize, debouncedSearch,
    sortKey, sortDir,
    // setters
    setSearch,
    setFilterModo: (v: string) => setFilter("modo", v, "todos"),
    setFilterEstado: (v: string) => setFilter("estado", v, "todos"),
    setFilterCliente: (v: string) => setFilter("cliente", v, "todos"),
    setFilterOperador: (v: string) => setFilter("operador", v, "todos"),

    setFechaDesde: (v: string) => setFilter("fechaDesde", v, ""),
    setFechaHasta: (v: string) => setFilter("fechaHasta", v, ""),
    setPage: (p: number) => setPageRaw(p === 0 ? null : p),
    setPageSize: (s: number) => {
      setPageSizeRaw(s === DEFAULT_PAGE_SIZE ? null : s);
      setPageRaw(null);
    },
    handleSortChange: (key: string | null, dir: SortDir) => {
      setSortKeyRaw(!key || key === "expediente" ? null : key);
      setSortDirRaw(dir === "desc" ? null : dir);
      setPageRaw(null);
    },
    // data
    embarques, filtered, totalCount: totalCountServer, displayCount,
    expedientesCount, contenedoresCount, totalPages, isLoading, isEmptyState,
    contenedoresPorExpediente,
    extras,
  };
}
