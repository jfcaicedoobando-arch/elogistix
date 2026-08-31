/**
 * Controller de la página de listado de Cotizaciones.
 *
 * YG-03: la paginación, el orden, la búsqueda y los filtros se resuelven en el
 * servidor (`services/paginados.ts`) y los KPIs/conteos con `count: "exact"`
 * (`services/agregados.ts`). Antes se traían hasta 1000 filas (`CAP_POSTGREST`)
 * y todo se filtraba/paginaba en memoria: con más de 1000 cotizaciones las más
 * viejas desaparecían del listado, de los KPIs y del CSV.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerPagedList } from "@/hooks/shared/useServerPagedList";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { useClientesForSelect } from "@/features/cliente/hooks/useClientes";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { staleTimes } from "@/lib/query/staleTimes";
import { useCotizacionActions } from "./useCotizacionActions";
import {
  fetchCotizacionesPaginadas,
  fetchTodasCotizacionesParaExportar,
  SORT_KEY_TO_COLUMN,
  type CotizacionesFiltrosSql,
} from "@/features/cotizacion/services/paginados";
import { fetchCotizacionAgregados } from "@/features/cotizacion/services/agregados";
import type { CotizacionListItem, SegmentoCotizacion } from "@/features/cotizacion/services/cotizacionListTypes";

export const ESTADOS_COTIZACION = [
  "Borrador",
  "Solicitada",
  "Enviada",
  "Aceptada",
  "Rechazada",
  "Vencida",
  "Archivada",
  "En operación",
];

// re-export for backward-compat with prior single-file controller.
export { useCotizacionActions };
export type { CotizacionListItem, SegmentoCotizacion };

const DEFAULT_FILTERS = {
  estado: "todos",
  cliente: "todos",
  sinCostos: "no",
  incluirInactivas: "no",
  aceptadasSinEmbarque: "no",
  // Por defecto se muestran las cotizaciones a clientes; la prospección
  // (CRM) vive en su propio segmento para no mezclar embudos.
  segmento: "clientes",
} as const;

type CotizacionFilters = Record<keyof typeof DEFAULT_FILTERS, string>;

const SORTABLE_KEYS = Object.keys(SORT_KEY_TO_COLUMN);
const KPIS_VACIOS = { total: 0, aceptadas: 0, rechazadas: 0, tasa: "0.0" };
const CONTEOS_VACIOS = { clientes: 0, prospectos: 0, todas: 0 };

function normalizarSegmento(valor: string): SegmentoCotizacion {
  return valor === "prospectos" || valor === "todas" ? valor : "clientes";
}

function aFiltrosSql(
  organizationId: string | null,
  search: string,
  filters: CotizacionFilters,
): CotizacionesFiltrosSql {
  return {
    organizationId,
    search,
    filterEstado: filters.estado,
    filterCliente: filters.cliente,
    filterSinCostos: filters.sinCostos === "si",
    incluirInactivas: filters.incluirInactivas === "si",
    soloAceptadasSinEmbarque: filters.aceptadasSinEmbarque === "si",
    segmento: normalizarSegmento(filters.segmento),
  };
}

export function useCotizacionesPageController() {
  const { canEdit } = usePermissions();
  const { organizationId } = useOrgFilter();
  const { data: clientes = [] } = useClientesForSelect();
  const actions = useCotizacionActions();

  const listQueryKey = ["cotizaciones", "paginadas", organizationId];
  const lista = useServerPagedList<CotizacionListItem, CotizacionFilters>({
    queryKey: listQueryKey,
    defaultFilters: { ...DEFAULT_FILTERS },
    defaultPageSize: 50,
    defaultSort: { key: "fecha", dir: "desc" },
    sortableKeys: SORTABLE_KEYS,
    filterLabels: {
      estado: "Estado",
      cliente: "Cliente",
      sinCostos: "Sin costos",
      incluirInactivas: "Incl. inactivas",
      aceptadasSinEmbarque: "Aceptadas sin embarque",
      // El segmento se controla con tabs propios, no como chip de filtro.
      segmento: "Segmento",
    },
    fetcher: (args) =>
      fetchCotizacionesPaginadas({
        ...aFiltrosSql(organizationId, args.search, args.filters),
        page: args.page,
        pageSize: args.pageSize,
        sortKey: args.sortKey,
        sortDir: args.sortDir,
      }),
  });

  const segmento = normalizarSegmento(lista.filters.segmento);

  const agregadosQueryKey = ["cotizaciones", "agregados", organizationId, segmento];
  const { data: agregados } = useQuery({
    queryKey: agregadosQueryKey,
    queryFn: () => fetchCotizacionAgregados(organizationId, segmento),
    staleTime: staleTimes.MEDIUM,
  });

  const filtrosActuales = aFiltrosSql(organizationId, lista.search, lista.filters);

  return {
    // datos
    isLoading: lista.isLoading,
    isError: !!lista.error,
    refetch: lista.refetch,
    clientes,
    paginated: lista.rows,
    /** Total del servidor (ya no es el largo del array en memoria). */
    total: lista.count,
    kpis: agregados?.kpis ?? KPIS_VACIOS,
    canEdit,
    // filtros
    search: lista.search,
    filterEstado: lista.filters.estado,
    filterCliente: lista.filters.cliente,
    filterSinCostos: lista.filters.sinCostos === "si",
    incluirInactivas: lista.filters.incluirInactivas === "si",
    soloAceptadasSinEmbarque: lista.filters.aceptadasSinEmbarque === "si",
    segmento,
    segmentoConteos: agregados?.segmentoConteos ?? CONTEOS_VACIOS,
    totalAceptadasSinEmbarque: agregados?.totalAceptadasSinEmbarque ?? 0,
    page: lista.page,
    pageSize: lista.pageSize,
    totalPages: lista.totalPages,
    setSearch: lista.setSearch,
    setFilter: lista.setFilter,
    setPage: lista.setPage,
    setPageSize: lista.setPageSize,
    controlledSort: lista.controlledSort,
    setSort: lista.setSort,
    pagination: lista.pagination,
    // UnifiedFiltersBar
    activeChips: lista.activeChips,
    activeCount: lista.activeCount,
    resetAll: lista.resetAll,
    // acciones (delegadas a useCotizacionActions)
    cotizacionAEliminar: actions.cotizacionAEliminar,
    setCotizacionAEliminar: actions.setCotizacionAEliminar,
    isDeleting: actions.isDeleting,
    confirmarEliminar: actions.confirmarEliminar,
    /** YG-03: el CSV trae TODO lo filtrado (iterando por lotes), no la página. */
    exportar: () =>
      actions.exportar(() =>
        fetchTodasCotizacionesParaExportar(filtrosActuales, lista.sortKey, lista.sortDir),
      ),
    irANueva: actions.irANueva,
    irAEditar: actions.irAEditar,
    irADetalle: actions.irADetalle,
    prefetchCotizacion: actions.prefetchCotizacion,
  };
}
