import { useMemo } from "react";
import { useTableFilters } from "@/hooks/shared/useTableFilters";
import { useCotizaciones } from "@/features/cotizacion/hooks/useCotizaciones";
import { useClientesForSelect } from "@/features/cliente/hooks/useClientes";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { ESTADOS_INACTIVOS } from "@/features/cotizacion/domain/lifecycle";
import { useCotizacionActions } from "./useCotizacionActions";

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

export type CotizacionListItem = NonNullable<ReturnType<typeof useCotizaciones>["data"]>[number];

// ── Pure filter helpers ──────────────────────────────────────────────────────

export function matchesSearch(c: CotizacionListItem, search: string): boolean {
  // EC-7: `folio`, `cliente_nombre` y `descripcion_mercancia` pueden llegar
  // NULL desde la BD (cotizaciones legacy o borradores sin mercancía); antes
  // el listado crasheaba con "Cannot read properties of null".
  if (!search) return true;
  const q = search.toLowerCase();
  const campos = [c.folio, c.cliente_nombre, c.descripcion_mercancia];
  return campos.some((campo) => (campo ?? "").toLowerCase().includes(q));
}

export function esCotizacionInactivaOculta(
  c: CotizacionListItem,
  incluirInactivas: boolean,
  filterEstado: string,
): boolean {
  const esInactiva = (ESTADOS_INACTIVOS as readonly string[]).includes(c.estado ?? "");
  if (!esInactiva) return false;
  if (incluirInactivas) return false;
  if (filterEstado !== "todos" && filterEstado === c.estado) return false;
  return true;
}

/** Segmento comercial: separa la prospección (CRM) de la operación con clientes. */
export type SegmentoCotizacion = "clientes" | "prospectos" | "todas";

export function matchesSegmento(c: CotizacionListItem, segmento: SegmentoCotizacion): boolean {
  if (segmento === "todas") return true;
  const esProspecto = c.es_prospecto === true;
  return segmento === "prospectos" ? esProspecto : !esProspecto;
}

export interface CotizacionFilterParams {
  search: string;
  filterEstado: string;
  filterCliente: string;
  filterSinCostos: boolean;
  incluirInactivas: boolean;
  /** O4.5(a): bandeja "Aceptadas sin embarque" (estado Aceptada y sin embarque_id). */
  soloAceptadasSinEmbarque: boolean;
  segmento: SegmentoCotizacion;
}

/** O4.5(a): la cotización quedó aceptada pero nadie abrió el embarque. */
export function esAceptadaSinEmbarque(c: CotizacionListItem): boolean {
  return c.estado === "Aceptada" && !c.embarque_id;
}

export function matchesCotizacionFilter(
  c: CotizacionListItem,
  p: CotizacionFilterParams,
): boolean {
  if (!matchesSegmento(c, p.segmento)) return false;
  if (!matchesSearch(c, p.search)) return false;
  if (p.filterEstado !== "todos" && c.estado !== p.filterEstado) return false;
  if (p.filterCliente !== "todos" && c.cliente_id !== p.filterCliente) return false;
  if (p.filterSinCostos && !(!!c.sin_desglose_costos && ((c.cotizacion_costos_count ?? 0) === 0))) return false;
  if (p.soloAceptadasSinEmbarque && !esAceptadaSinEmbarque(c)) return false;
  if (esCotizacionInactivaOculta(c, p.incluirInactivas, p.filterEstado)) return false;
  return true;
}

/** KPIs derivados — siempre últimos 30 días, ignoran filtros visibles (salvo el segmento). */
export function useCotizacionKpis(cotizaciones: CotizacionListItem[], segmento: SegmentoCotizacion) {
  return useMemo(() => {
    const hace30Dias = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const ultimos30 = cotizaciones.filter((c) => {
      if (!matchesSegmento(c, segmento)) return false;
      if (!c.created_at) return false;
      const ts = new Date(c.created_at).getTime();
      return Number.isFinite(ts) && ts >= hace30Dias;
    });
    const total = ultimos30.length;
    const aceptadas = ultimos30.filter(
      (c) => c.estado === "Aceptada" || c.estado === "En operación",
    ).length;
    const rechazadas = ultimos30.filter((c) => c.estado === "Rechazada").length;
    const tasa = total > 0 ? ((aceptadas / total) * 100).toFixed(1) : "0.0";
    return { total, aceptadas, rechazadas, tasa };
  }, [cotizaciones, segmento]);
}

// ── Hook composer ───────────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  estado: "todos",
  cliente: "todos",
  sinCostos: "no",
  incluirInactivas: "no",
  aceptadasSinEmbarque: "no",
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
    },
  });

  const filterEstado = tf.filters.estado;
  const filterCliente = tf.filters.cliente;
  const filterSinCostos = tf.filters.sinCostos === "si";
  const incluirInactivas = tf.filters.incluirInactivas === "si";
  const soloAceptadasSinEmbarque = tf.filters.aceptadasSinEmbarque === "si";

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
        }),
      ),
    [
      cotizaciones, tf.search, filterEstado, filterCliente, filterSinCostos,
      incluirInactivas, soloAceptadasSinEmbarque,
    ],
  );

  // O4.5(a): contador de la bandeja, independiente de los filtros visibles.
  const totalAceptadasSinEmbarque = useMemo(
    () => cotizaciones.filter(esAceptadaSinEmbarque).length,
    [cotizaciones],
  );


  const { items: paginated, totalPages } = tf.paginate(filtered);
  const kpis = useCotizacionKpis(cotizaciones);

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
