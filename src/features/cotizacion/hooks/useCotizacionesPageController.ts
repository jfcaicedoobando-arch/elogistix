import { useMemo } from "react";
import { useTableFilters } from "@/hooks/shared/useTableFilters";
import { useCotizaciones } from "@/features/cotizacion/hooks/useCotizaciones";
import { useClientesForSelect } from "@/features/cliente/hooks/useClientes";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useCotizacionActions } from "./useCotizacionActions";
import {
  esAceptadaSinEmbarque,
  matchesCotizacionFilter,
  useCotizacionKpis,
  type SegmentoCotizacion,
} from "./cotizacionesListFilters";

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

export type { CotizacionListItem, SegmentoCotizacion, CotizacionFilterParams } from "./cotizacionesListFilters";
export {
  matchesSearch,
  esCotizacionInactivaOculta,
  matchesSegmento,
  esAceptadaSinEmbarque,
  matchesCotizacionFilter,
  useCotizacionKpis,
} from "./cotizacionesListFilters";

// ── Hook composer ───────────────────────────────────────────────────────────

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

/**
 * Controller de la página de listado de Cotizaciones.
 * Ensambla queries + filtros/paginación + KPIs derivados + acciones de fila.
 *
 * v14: migrado a `useTableFilters` + `UnifiedFiltersBar`.
 */
export function useCotizacionesPageController() {
  const { canEdit } = usePermissions();
  // R-06: la vista necesita distinguir "sin resultados" de "la consulta falló".
  const { data: cotizaciones = [], isLoading, isError, refetch } = useCotizaciones();
  const { data: clientes = [] } = useClientesForSelect();
  const actions = useCotizacionActions();

  const tf = useTableFilters<CotizacionFilters>({
    defaultFilters: { ...DEFAULT_FILTERS },
    defaultPageSize: 50,
    filterLabels: {
      estado: "Estado",
      cliente: "Cliente",
      sinCostos: "Sin costos",
      incluirInactivas: "Incl. inactivas",
      aceptadasSinEmbarque: "Aceptadas sin embarque",
      // El segmento se controla con tabs propios, no como chip de filtro.
      segmento: "Segmento",
    },
  });

  const filterEstado = tf.filters.estado;
  const filterCliente = tf.filters.cliente;
  const filterSinCostos = tf.filters.sinCostos === "si";
  const incluirInactivas = tf.filters.incluirInactivas === "si";
  const soloAceptadasSinEmbarque = tf.filters.aceptadasSinEmbarque === "si";
  const segmento = (tf.filters.segmento === "prospectos" || tf.filters.segmento === "todas"
    ? tf.filters.segmento
    : "clientes") as SegmentoCotizacion;

  const filtered = useMemo(
    () =>
      cotizaciones.filter((c) =>
        matchesCotizacionFilter(c, {
          search: tf.search,
          filterEstado,
          filterCliente,
          filterSinCostos,
          incluirInactivas,
          soloAceptadasSinEmbarque,
          segmento,
        }),
      ),
    [
      cotizaciones, tf.search, filterEstado, filterCliente, filterSinCostos,
      incluirInactivas, soloAceptadasSinEmbarque, segmento,
    ],
  );

  // Conteos por segmento para los tabs (ignoran el resto de filtros).
  const segmentoConteos = useMemo(() => {
    let clientes = 0;
    let prospectos = 0;
    for (const c of cotizaciones) {
      if (c.es_prospecto === true) prospectos += 1;
      else clientes += 1;
    }
    return { clientes, prospectos, todas: clientes + prospectos };
  }, [cotizaciones]);

  // O4.5(a): contador de la bandeja, independiente de los filtros visibles.
  const totalAceptadasSinEmbarque = useMemo(
    () => cotizaciones.filter(esAceptadaSinEmbarque).length,
    [cotizaciones],
  );


  const { items: paginated, totalPages } = tf.paginate(filtered);
  const kpis = useCotizacionKpis(cotizaciones, segmento);

  return {
    // datos
    isLoading,
    isError,
    refetch,
    clientes,
    paginated,
    filtered,
    kpis,
    canEdit,
    // filtros (compatibilidad)
    search: tf.search, filterEstado,
    filterCliente,
    filterSinCostos,
    incluirInactivas,
    soloAceptadasSinEmbarque,
    segmento,
    segmentoConteos,
    totalAceptadasSinEmbarque,
    page: tf.page, pageSize: tf.pageSize, totalPages,
    setSearch: tf.setSearch, setFilter: tf.setFilter,
    setPage: tf.setPage, setPageSize: tf.setPageSize,
    // UnifiedFiltersBar
    activeChips: tf.activeChips, activeCount: tf.activeCount, resetAll: tf.resetAll,
    // acciones (delegadas a useCotizacionActions)
    cotizacionAEliminar: actions.cotizacionAEliminar,
    setCotizacionAEliminar: actions.setCotizacionAEliminar, isDeleting: actions.isDeleting,
    confirmarEliminar: actions.confirmarEliminar,
    exportar: () => actions.exportar(filtered),
    irANueva: actions.irANueva, irAEditar: actions.irAEditar,
    irADetalle: actions.irADetalle, prefetchCotizacion: actions.prefetchCotizacion,
  };
}
