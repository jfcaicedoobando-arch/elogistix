/**
 * Estado y filtros de la página de listado de Embarques.
 * v8.153.2 — con filtro por estado se trae el set completo (client-side).
 * 11.14.0 — helpers puros en `domain/embarquesPageHelpers`.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEmbarquesPaginados } from "@/features/embarques/hooks/useEmbarques";
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
  applyClientFilters,
  computeSinFiltros,
  type SortDir,
} from "@/features/embarques/domain/embarquesPageHelpers";
import { buildEmbarquesPageActions } from "@/features/embarques/hooks/useEmbarquesPageActions";

;



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
  const { data: resultadoServer, isLoading: loadingServer, isError: errorServer, refetch: refetchServer } = useEmbarquesPaginados({
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
  const { data: resultadoFull, isLoading: loadingFull, isError: errorFull, refetch: refetchFull } = useQuery({
    queryKey: queryKeys.embarques.fullForEstadoFilter(fullSetFilters),
    queryFn: () => fetchEmbarquesParaExport(fullSetFilters),
    enabled: fullSetActivo,
    staleTime: 60_000,
  });

  const isLoading = fullSetActivo ? loadingFull : loadingServer;
  const isError = fullSetActivo ? errorFull : errorServer;
  const refetch = fullSetActivo ? refetchFull : refetchServer;

  const alertIdSet = useMemo(() => {
    if (!alertaFilterActivo || !alertasResumen) return null;
    return alertasResumen[filterAlerta] ?? new Set<string>();
  }, [alertaFilterActivo, alertasResumen, filterAlerta]);

  const containersForView: EmbarqueRow[] = useMemo(() => {
    if (!fullSetActivo) return resultadoServer?.data ?? [];
    return applyClientFilters(resultadoFull ?? [], {
      estadoFilterActivo,
      alertaFilterActivo,
      alertIdSet,
      filterEstado,
    });
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
    if (!fullSetActivo) return dedupedAll;
    return [...dedupedAll].sort((a, b) => compareBy(a, b, sortKey, sortDir));
  }, [fullSetActivo, dedupedAll, sortKey, sortDir]);

  const counts = computeCounts({
    estadoFilterActivo: fullSetActivo,
    dedupedAll,
    containersForView,
    sortedAll,
    pageSize,
    totalCountServer: resultadoServer?.count ?? 0,
  });
  const { expedientesCount, contenedoresCount, totalPages, totalCountServer } = counts;

  const filtered = useMemo(() => {
    if (!fullSetActivo) return dedupedAll;
    const from = page * pageSize;
    return sortedAll.slice(from, from + pageSize);
  }, [fullSetActivo, dedupedAll, sortedAll, page, pageSize]);

  const embarques: EmbarqueRow[] = useMemo(
    () => (fullSetActivo ? filtered : (resultadoServer?.data ?? [])),
    [fullSetActivo, filtered, resultadoServer?.data],
  );

  // ---------- Extras (liquidación + docs) ----------
  const visibleIds = useMemo(() => embarques.map((e) => e.id), [embarques]);
  const { data: extrasBranchB } = useQuery({
    queryKey: queryKeys.embarques.extrasBranchB(visibleIds),
    queryFn: () => fetchEmbarquesListExtras(visibleIds),
    enabled: fullSetActivo && visibleIds.length > 0,
    staleTime: 30_000,
  });
  const extras = resolveExtras(fullSetActivo, extrasBranchB, resultadoServer?.extras);

  const displayCount = expedientesCount;

  const sinFiltros = computeSinFiltros({
    debouncedSearch,
    filterModo, filterEstado, filterCliente, filterOperador,
    filterAlerta, fechaDesde, fechaHasta,
  });
  // v13.303.75 · un fallo de red NO es un "sin resultados": exigimos !isError.
  const isEmptyState = !isLoading && !isError && containersForView.length === 0 && sinFiltros;


  const actions = buildEmbarquesPageActions({
    DEFAULT_PAGE_SIZE,
    setFilter,
    setAlerta,
    setPageRaw,
    setPageSizeRaw,
    setSortKeyRaw,
    setSortDirRaw,
  });

  return {
    search,
    filterModo, filterEstado, filterCliente, filterOperador, filterAlerta,
    fechaDesde, fechaHasta, page, pageSize, debouncedSearch,
    sortKey, sortDir,
    setSearch,
    ...actions,
    embarques, filtered, totalCount: totalCountServer, displayCount,
    expedientesCount, contenedoresCount, totalPages, isLoading, isError, refetch, isEmptyState,
    contenedoresPorExpediente,
    extras,
    alertasResumen, alertIdSet,
  };
}

