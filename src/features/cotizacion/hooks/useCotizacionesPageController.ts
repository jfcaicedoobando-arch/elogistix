import { useMemo } from "react";
import { useListPageState } from "@/hooks/shared/useListPageState";
import { useCotizaciones } from "@/features/cotizacion/hooks/useCotizaciones";
import { useClientesForSelect } from "@/features/cliente/hooks/useClientes";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { ESTADOS_INACTIVOS } from "@/features/cotizacion/domain/lifecycle";
import { useCotizacionActions } from "./useCotizacionActions";

export const ESTADOS_COTIZACION = [
  "Borrador",
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

/**
 * Controller de la página de listado de Cotizaciones.
 * Ensambla queries + filtros/paginación + KPIs derivados + acciones de fila.
 *
 * v13.56.4: dividido en sub-hooks `useCotizacionActions` y `useCotizacionKpis`
 * (auditoría — paso 12). Las firmas públicas se conservan.
 */
export function useCotizacionesPageController() {
  const { canEdit } = usePermissions();
  const { data: cotizaciones = [], isLoading } = useCotizaciones();
  const { data: clientes = [] } = useClientesForSelect();
  const actions = useCotizacionActions();

  const {
    search, filters, page, pageSize,
    setSearch, setFilter, setPage, setPageSize, paginate,
  } = useListPageState(
    { estado: "todos", cliente: "todos", sinCostos: "no", incluirInactivas: "no" },
    50, // v13.139.17 — default reducido de 100 → 50 para acortar la página en Full HD.
  );

  const filterEstado = filters.estado;
  const filterCliente = filters.cliente;
  const filterSinCostos = filters.sinCostos === "si";
  const incluirInactivas = filters.incluirInactivas === "si";

  const filtered = useMemo(() => {
    return cotizaciones.filter((c) =>
      matchesCotizacionFilter(c, { search, filterEstado, filterCliente, filterSinCostos, incluirInactivas }),
    );
  }, [cotizaciones, search, filterEstado, filterCliente, filterSinCostos, incluirInactivas]);

  const { items: paginated, totalPages } = paginate(filtered);
  const kpis = useCotizacionKpis(cotizaciones);

  const exportar = () => actions.exportar(filtered);

  return {
    // datos
    isLoading,
    clientes,
    paginated,
    filtered,
    kpis,
    canEdit,
    // estado de listado
    search, filterEstado, filterCliente, filterSinCostos, incluirInactivas,
    page, pageSize, totalPages,
    setSearch, setFilter, setPage, setPageSize,
    // acciones (delegadas a useCotizacionActions)
    cotizacionAEliminar: actions.cotizacionAEliminar,
    setCotizacionAEliminar: actions.setCotizacionAEliminar,
    confirmarEliminar: actions.confirmarEliminar,
    isDeleting: actions.isDeleting,
    exportar,
    irANueva: actions.irANueva,
    irAEditar: actions.irAEditar,
    irADetalle: actions.irADetalle,
    prefetchCotizacion: actions.prefetchCotizacion,
  };
}
