/**
 * Estado y filtros de la página de listado de Embarques.
 *
 * v8.153.2 — Cuando hay filtro por estado, se trae el set COMPLETO (sin paginar
 * server-side) porque el estado real se calcula client-side a partir de
 * etd/eta/estado. Sobre ese set se filtra, se agrupa por expediente, se
 * ordena y se pagina.
 *
 * 11.14.0: helpers puros (compareBy, computeCounts, resolveExtras,
 * buildFullSetFilters, dedupePorExpediente, contenedoresPorExpediente)
 * movidos a `lib/embarque/embarquesPageHelpers`.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEmbarquesPaginados, calcularEstadoEmbarque } from "@/features/embarques/hooks/useEmbarques";
import type { EmbarqueRow } from "@/features/embarques/hooks/useEmbarques";
import type { SortableEmbarqueColumn } from "@/features/embarques/services/queries";
import { SORT_KEY_TO_COLUMN } from "@/features/embarques/services/queries";
import { fetchEmbarquesParaExport, fetchEmbarquesListExtras } from "@/features/embarques/services";
import { useOrgFilter } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";
import { useEmbarquesFilters } from "@/features/embarques/hooks/useEmbarquesFilters";
import { useEmbarquesAlertasResumen } from "@/features/embarques/hooks/useEmbarquesAlertasResumen";
import {
  compareBy,
  computeCounts,
  resolveExtras,
  buildFullSetFilters,
  dedupePorExpediente,
  contenedoresPorExpediente as computeContenedoresPorExpediente,
  type SortDir,
} from "@/features/embarques/domain/embarquesPageHelpers";

export type { SortDir };

export function useEmbarquesPageState() {
  const { organizationId } = useOrgFilter();
  const {
    search, debouncedSearch, filters, alerta: filterAlerta, page, pageSize, sortKey, sortDir,
    DEFAULT_PAGE_SIZE, setSearch, setFilter, setAlerta,
    setPageRaw, setPageSizeRaw, setSortKeyRaw, setSortDirRaw,
  } = useEmbarquesFilters();

  const { data: alertasResumen } = useEmbarquesAlertasResumen();

  const {
    modo: filterModo,
    estado: filterEstado,
    cliente: filterCliente,
    operador: filterOperador,
    fechaDesde,
    fechaHasta,
  } = filters;

  const estadoFilterActivo = filterEstado !== "todos";
  const alertaFilterActivo = filterAlerta !== "todos";
  // Cuando hay filtro por estado o por alerta necesitamos el set completo
  // (la pertenencia a una alerta se decide client-side contra IDs).
  const fullSetActivo = estadoFilterActivo || alertaFilterActivo;
  const sortBy: SortableEmbarqueColumn | undefined = sortKey
    ? SORT_KEY_TO_COLUMN[sortKey]
    : undefined;

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
    queryKey: queryKeys.embarques.fullForEstadoFilter(fullSetFilters),
    queryFn: () => fetchEmbarquesParaExport(fullSetFilters),
    enabled: fullSetActivo,
    staleTime: 60_000,
  });

  const isLoading = fullSetActivo ? loadingFull : loadingServer;

  const alertIdSet = useMemo(() => {
    if (!alertaFilterActivo || !alertasResumen) return null;
    return alertasResumen[filterAlerta] ?? new Set<string>();
  }, [alertaFilterActivo, alertasResumen, filterAlerta]);

  const containersForView: EmbarqueRow[] = useMemo(() => {
    if (!fullSetActivo) return resultadoServer?.data ?? [];
    let all = resultadoFull ?? [];
    if (estadoFilterActivo) {
      all = all.filter(
        (e) => calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado) === filterEstado,
      );
    }
    if (alertaFilterActivo && alertIdSet) {
      all = all.filter((e) => alertIdSet.has(e.id));
    }
    return all;
  }, [fullSetActivo, estadoFilterActivo, alertaFilterActivo, alertIdSet, resultadoServer, resultadoFull, filterEstado]);

  const contenedoresPorExpediente = useMemo(
    () => computeContenedoresPorExpediente(containersForView),
    [containersForView],
  );

  const dedupedAll = useMemo(
    () => dedupePorExpediente(containersForView),
    [containersForView],
  );

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
    queryKey: queryKeys.embarques.extrasBranchB(visibleIds),
    queryFn: () => fetchEmbarquesListExtras(visibleIds),
    enabled: estadoFilterActivo && visibleIds.length > 0,
    staleTime: 30_000,
  });
  const extras = resolveExtras(estadoFilterActivo, extrasBranchB, resultadoServer?.extras);

  const displayCount = expedientesCount;

  const sinFiltros =
    !debouncedSearch &&
    [filterModo, filterEstado, filterCliente, filterOperador].every((v) => v === "todos") &&
    !fechaDesde &&
    !fechaHasta;
  const isEmptyState = !isLoading && containersForView.length === 0 && sinFiltros;

  return {
    search,
    filterModo, filterEstado, filterCliente, filterOperador,
    fechaDesde, fechaHasta, page, pageSize, debouncedSearch,
    sortKey, sortDir,
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
    embarques, filtered, totalCount: totalCountServer, displayCount,
    expedientesCount, contenedoresCount, totalPages, isLoading, isEmptyState,
    contenedoresPorExpediente,
    extras,
  };
}
