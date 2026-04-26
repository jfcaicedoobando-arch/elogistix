import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useListPageState } from "@/hooks/useListPageState";
import { useCotizaciones, useDeleteCotizacion, usePrefetchCotizacion } from "@/hooks/useCotizaciones";
import { useDuplicarCotizacion } from "@/hooks/cotizacion/useDuplicarCotizacion";
import { useClientesForSelect } from "@/hooks/cliente/useClientes";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/errors";
import { exportToCsv } from "@/generators/exportCsv";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export const ESTADOS_COTIZACION = [
  "Borrador",
  "Enviada",
  "Aceptada",
  "Rechazada",
  "Vencida",
  "Embarcada",
];

export type CotizacionListItem = NonNullable<ReturnType<typeof useCotizaciones>["data"]>[number];

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
  const duplicarCotizacion = useDuplicarCotizacion();

  const [cotizacionAEliminar, setCotizacionAEliminar] = useState<string | null>(null);

  const {
    search, filters, page, pageSize,
    setSearch, setFilter, setPage, setPageSize, paginate,
  } = useListPageState({ estado: "todos", cliente: "todos" });

  const filterEstado = filters.estado;
  const filterCliente = filters.cliente;

  const filtered = useMemo(() => {
    return cotizaciones.filter((c) => {
      const matchSearch = !search ||
        c.folio.toLowerCase().includes(search.toLowerCase()) ||
        c.cliente_nombre.toLowerCase().includes(search.toLowerCase()) ||
        c.descripcion_mercancia.toLowerCase().includes(search.toLowerCase());
      const matchEstado = filterEstado === "todos" || c.estado === filterEstado;
      const matchCliente = filterCliente === "todos" || c.cliente_id === filterCliente;
      return matchSearch && matchEstado && matchCliente;
    });
  }, [cotizaciones, search, filterEstado, filterCliente]);

  const { items: paginated, totalPages } = paginate(filtered);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const aceptadas = filtered.filter(
      (c) => c.estado === "Aceptada" || c.estado === "Embarcada",
    ).length;
    const rechazadas = filtered.filter((c) => c.estado === "Rechazada").length;
    const tasa = total > 0 ? ((aceptadas / total) * 100).toFixed(1) : "0.0";
    return { total, aceptadas, rechazadas, tasa };
  }, [filtered]);

  const irANueva = () => navigate("/cotizaciones/nueva");
  const irAEditar = (id: string) => navigate(`/cotizaciones/${id}/editar`);
  const irADetalle = (id: string) => navigate(`/cotizaciones/${id}`);

  const duplicar = (id: string) => {
    duplicarCotizacion.mutate(id, {
      onSuccess: (data) => {
        notifySuccess(toast, { title: "Cotización duplicada", description: `Se creó ${data.folio} como Borrador.` });
      },
      onError: (err) => {
        notifyError(toast, { title: "Error al duplicar", description: getErrorMessage(err)});
      },
    });
  };

  const confirmarEliminar = async () => {
    if (!cotizacionAEliminar) return;
    try {
      await deleteCotizacion.mutateAsync(cotizacionAEliminar);
      notifySuccess(toast, { title: "Cotización eliminada correctamente" });
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al eliminar", description: getErrorMessage(err)});
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
    search, filterEstado, filterCliente,
    page, pageSize, totalPages,
    setSearch, setFilter, setPage, setPageSize,
    // acciones
    cotizacionAEliminar,
    setCotizacionAEliminar,
    confirmarEliminar,
    isDeleting: deleteCotizacion.isPending,
    duplicar,
    exportar,
    irANueva,
    irAEditar,
    irADetalle,
    prefetchCotizacion,
  };
}
