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
  return (
    !search ||
    c.folio.toLowerCase().includes(search.toLowerCase()) ||
    c.cliente_nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.descripcion_mercancia.toLowerCase().includes(search.toLowerCase())
  );
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

export interface CotizacionFilterParams {
  search: string;
  filterEstado: string;
  filterCliente: string;
  filterSinCostos: boolean;
  incluirInactivas: boolean;
}

export function matchesCotizacionFilter(
  c: CotizacionListItem,
  p: CotizacionFilterParams,
): boolean {
  if (!matchesSearch(c, p.search)) return false;
  if (p.filterEstado !== "todos" && c.estado !== p.filterEstado) return false;
  if (p.filterCliente !== "todos" && c.cliente_id !== p.filterCliente) return false;
  if (p.filterSinCostos && !(!!c.sin_desglose_costos && ((c.cotizacion_costos_count ?? 0) === 0))) return false;
  if (esCotizacionInactivaOculta(c, p.incluirInactivas, p.filterEstado)) return false;
  return true;
}

/** KPIs derivados — siempre últimos 30 días, ignoran filtros visibles. */
export function useCotizacionKpis(cotizaciones: CotizacionListItem[]) {
  return useMemo(() => {
    const hace30Dias = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const ultimos30 = cotizaciones.filter((c) => {
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
  }, [cotizaciones]);
}

// ── Hook composer ───────────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  estado: "todos",
  cliente: "todos",
  sinCostos: "no",
  incluirInactivas: "no",
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
  const { data: cotizaciones = [], isLoading } = useCotizaciones();
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
    },
  });

  const filterEstado = tf.filters.estado;
  const filterCliente = tf.filters.cliente;
  const filterSinCostos = tf.filters.sinCostos === "si";
  const incluirInactivas = tf.filters.incluirInactivas === "si";

  const filtered = useMemo(
    () =>
      cotizaciones.filter((c) =>
        matchesCotizacionFilter(c, {
          search: tf.search,
          filterEstado,
          filterCliente,
          filterSinCostos,
          incluirInactivas,
        }),
      ),
    [cotizaciones, tf.search, filterEstado, filterCliente, filterSinCostos, incluirInactivas],
  );

  const { items: paginated, totalPages } = tf.paginate(filtered);
  const kpis = useCotizacionKpis(cotizaciones);

  return {
    // datos
    isLoading,
    clientes,
    paginated,
    filtered,
    kpis,
    canEdit,
    // filtros (compatibilidad)
    search: tf.search,
    filterEstado,
    filterCliente,
    filterSinCostos,
    incluirInactivas,
    page: tf.page,
    pageSize: tf.pageSize,
    totalPages,
    setSearch: tf.setSearch,
    setFilter: tf.setFilter,
    setPage: tf.setPage,
    setPageSize: tf.setPageSize,
    // UnifiedFiltersBar
    activeChips: tf.activeChips,
    activeCount: tf.activeCount,
    resetAll: tf.resetAll,
    // acciones (delegadas a useCotizacionActions)
    cotizacionAEliminar: actions.cotizacionAEliminar,
    setCotizacionAEliminar: actions.setCotizacionAEliminar,
    confirmarEliminar: actions.confirmarEliminar,
    isDeleting: actions.isDeleting,
    exportar: () => actions.exportar(filtered),
    irANueva: actions.irANueva,
    irAEditar: actions.irAEditar,
    irADetalle: actions.irADetalle,
    prefetchCotizacion: actions.prefetchCotizacion,
  };
}
