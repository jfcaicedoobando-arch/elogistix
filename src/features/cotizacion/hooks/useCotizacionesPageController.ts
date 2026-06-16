import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/shared";
import { useListPageState } from "@/hooks/shared/useListPageState";
import { useCotizaciones, useDeleteCotizacion, usePrefetchCotizacion } from "@/features/cotizacion/hooks/useCotizaciones";

import { useClientesForSelect } from "@/features/cliente/hooks/useClientes";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { getErrorMessage } from "@/lib/errors";
import { exportToCsv } from "@/generators/exportCsv";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { ESTADOS_INACTIVOS } from "@/features/cotizacion/domain/lifecycle";

export const ESTADOS_COTIZACION = [
  "Borrador",
  "Enviada",
  "Aceptada",
  "Rechazada",
  "Vencida",
  "Archivada",
  "En operación",
];


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

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Controller de la página de listado de Cotizaciones.
 * Centraliza queries, filtros, KPIs derivados y handlers de acciones de fila.
 */
export function useCotizacionesPageController() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canEdit } = usePermissions();

  const { data: cotizaciones = [], isLoading } = useCotizaciones();
  const { data: clientes = [] } = useClientesForSelect();
  const prefetchCotizacion = usePrefetchCotizacion();
  const deleteCotizacion = useDeleteCotizacion();


  const [cotizacionAEliminar, setCotizacionAEliminar] = useState<string | null>(null);

  const {
    search, filters, page, pageSize,
    setSearch, setFilter, setPage, setPageSize, paginate,
  } = useListPageState({ estado: "todos", cliente: "todos", sinCostos: "no", incluirInactivas: "no" });

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

  // KPIs basados solo en cotizaciones creadas en los últimos 30 días.
  // No dependen de los filtros visibles de la tabla.
  const kpis = useMemo(() => {
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

  const irANueva = () => navigate("/cotizaciones/nueva");
  const irAEditar = (id: string) => navigate(`/cotizaciones/${id}/editar`);
  const irADetalle = (id: string) => navigate(`/cotizaciones/${id}`);


  const confirmarEliminar = async () => {
    if (!cotizacionAEliminar) return;
    try {
      await deleteCotizacion.mutateAsync(cotizacionAEliminar);
      notifySuccess(toast, { title: "Cotización eliminada correctamente" });
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al eliminar", description: getErrorMessage(err), error: err, method: "CONFIRMAR_ELIMINAR" });
    }
    setCotizacionAEliminar(null);
  };

  const exportar = () => {
    exportToCsv(
      `cotizaciones_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "folio", label: "Folio" },
        { key: "cliente", label: "Cliente" },
        { key: "modo", label: "Modo" },
        { key: "ruta", label: "Ruta" },
        { key: "subtotal", label: "Subtotal" },
        { key: "moneda", label: "Moneda" },
        { key: "estado", label: "Estado" },
        { key: "vigencia", label: "Vigencia" },
      ],
      filtered.map((c) => ({
        folio: c.folio,
        cliente: c.cliente_nombre,
        modo: c.modo,
        ruta: `${c.origen || ""} → ${c.destino || ""}`,
        subtotal: c.subtotal,
        moneda: c.moneda,
        estado: c.estado,
        vigencia: c.fecha_vigencia || "",
      })),
    );
  };

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
    // acciones
    cotizacionAEliminar,
    setCotizacionAEliminar,
    confirmarEliminar,
    isDeleting: deleteCotizacion.isPending,
    
    exportar,
    irANueva,
    irAEditar,
    irADetalle,
    prefetchCotizacion,
  };
}
