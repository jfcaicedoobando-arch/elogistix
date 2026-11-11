import { useQuery } from "@tanstack/react-query";
import { SORT_KEY_TO_COLUMN } from "@/features/embarques/services/queries";
import { useOrgFilter } from "@/hooks/shared";
import { useEmbarquesFilters } from "@/features/embarques/hooks/useEmbarquesFilters";
import { useEmbarquesAlertasResumen } from "@/features/embarques/hooks/useEmbarquesAlertasResumen";
import { computeSinFiltros } from "@/features/embarques/domain/embarquesPageHelpers";
import { buildEmbarquesPageActions } from "@/features/embarques/hooks/useEmbarquesPageActions";
import { embarqueQueries } from "@/features/embarques/queries";
import type { EmbarqueRow } from "@/features/embarques/types/embarque";

const SIN_FILAS: EmbarqueRow[] = [];
const SIN_EXTRAS = { liquidacion: {}, docs: {} };
const SIN_EXPEDIENTES: Record<string, number> = {};

export function useEmbarquesPageState() {
  const { organizationId, orgListo } = useOrgFilter();
  const {
    search, debouncedSearch, filters, alerta: filterAlerta, page, pageSize, sortKey, sortDir,
    DEFAULT_PAGE_SIZE, setSearch, setFilter, setAlerta,
    setPageRaw, setPageSizeRaw, setSortKeyRaw, setSortDirRaw,
  } = useEmbarquesFilters();
  const {
    modo: filterModo, estado: filterEstado, cliente: filterCliente,
    operador: filterOperador, fechaDesde, fechaHasta,
  } = filters;

  const { data: alertasResumen, isError: alertasError, refetch: refetchAlertas } =
    useEmbarquesAlertasResumen();
  const { data, isLoading, isError, refetch } = useQuery({
    ...embarqueQueries.list({
      organizationId, search: debouncedSearch, filterModo, filterEstado, filterCliente,
      filterOperador, filterAlerta, fechaDesde, fechaHasta, page, pageSize,
      sortBy: SORT_KEY_TO_COLUMN[sortKey], sortDir, agruparExpedientes: true,
    }),
    enabled: orgListo,
  });

  const embarques = data?.data ?? SIN_FILAS;
  const totalCount = data?.count ?? 0;
  const sinFiltros = computeSinFiltros({
    debouncedSearch, filterModo, filterEstado, filterCliente, filterOperador,
    filterAlerta, fechaDesde, fechaHasta,
  });
  const actions = buildEmbarquesPageActions({
    DEFAULT_PAGE_SIZE, setFilter, setAlerta, setSearch, setPageRaw, setPageSizeRaw, setSortKeyRaw, setSortDirRaw,
  });

  return {
    search, filterModo, filterEstado, filterCliente, filterOperador, filterAlerta,
    fechaDesde, fechaHasta, page, pageSize, debouncedSearch, sortKey, sortDir, setSearch,
    ...actions,
    embarques, filtered: embarques, totalCount, expedientesCount: totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    isLoading: !orgListo || isLoading,
    isError, refetch,
    isEmptyState: !!data && !isError && totalCount === 0 && sinFiltros,
    contenedoresPorExpediente: data?.filasPorExpediente ?? SIN_EXPEDIENTES,
    extras: data?.extras ?? SIN_EXTRAS,
    alertasResumen, alertasError, refetchAlertas,
  };
}
