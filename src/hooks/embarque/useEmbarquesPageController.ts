import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { exportToCsv } from "@/generators/exportCsv";
import { useEliminarEmbarque, calcularEstadoEmbarque, usePrefetchEmbarque } from "@/hooks/embarque/useEmbarques";
import type { EmbarqueRow } from "@/hooks/embarque/useEmbarques";
import { useOperadoresDistintos } from "@/hooks/catalogos/useOperadoresDistintos";
import { useClientesForSelect } from "@/hooks/cliente/useClientes";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useRegistrarActividad } from "@/hooks/shared/useBitacora";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { getOrigen, getDestino } from "@/lib/formatters";
import { useEmbarquesListExtras } from "@/hooks/embarque/useEmbarquesListData";
import { useEmbarquesPageState } from "@/hooks/embarque/useEmbarquesPageState";
import { buildEmbarqueColumns } from "@/components/embarque/embarqueColumns";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { fetchEmbarquesParaExport, fetchEmbarquesListExtras } from "@/services/embarque";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";

/**
 * Controller que centraliza estado, queries y handlers de la página de Embarques.
 * Mantiene la página enfocada únicamente en JSX/composición.
 */
export function useEmbarquesPageController() {
  const navigate = useNavigate();
  const { data: clientes = [] } = useClientesForSelect();
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const eliminarEmbarque = useEliminarEmbarque();
  const registrarActividad = useRegistrarActividad();
  const prefetchEmbarque = usePrefetchEmbarque();

  const state = useEmbarquesPageState();
  const { embarques, isLoading, isEmptyState, contenedoresPorExpediente } = state;

  const [embarqueAEliminar, setEmbarqueAEliminar] = useState<EmbarqueRow | null>(null);
  const [embarqueADuplicar, setEmbarqueADuplicar] = useState<EmbarqueRow | null>(null);
  const [exportandoCsv, setExportandoCsv] = useState(false);
  const { organizationId } = useOrgFilter();

  const { data: operadoresUnicos = [] } = useOperadoresDistintos();

  const embarqueIds = useMemo(() => embarques.map(e => e.id), [embarques]);
  const { data: extrasData } = useEmbarquesListExtras(embarqueIds);
  const liquidacionMap = extrasData?.liquidacion ?? {};
  const docsMap = extrasData?.docs ?? {};

  const handleEliminar = useCallback(async () => {
    if (!embarqueAEliminar) return;
    const { id, expediente, cliente_nombre, modo } = embarqueAEliminar;
    try {
      await eliminarEmbarque.mutateAsync(id);
      registrarActividad.mutate({
        accion: 'eliminar', modulo: 'embarques',
        entidad_id: id, entidad_nombre: expediente,
        detalles: { cliente: cliente_nombre, modo },
      });
      notifySuccess(toast, { title: "Embarque eliminado", description: `${expediente} fue eliminado permanentemente.` });
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al eliminar", description: getErrorMessage(err)});
    }
    setEmbarqueAEliminar(null);
  }, [embarqueAEliminar, eliminarEmbarque, registrarActividad, toast]);

  const columns = useMemo(
    () => buildEmbarqueColumns({
      canEdit,
      docsMap,
      liquidacionMap,
      contenedoresPorExpediente,
      onEditar: (e) => navigate(`/embarques/${e.id}/editar`),
      onDuplicar: setEmbarqueADuplicar,
      onEliminar: setEmbarqueAEliminar,
    }),
    [canEdit, liquidacionMap, docsMap, contenedoresPorExpediente, navigate],
  );

  const exportarCsv = useCallback(async () => {
    setExportandoCsv(true);
    try {
      // Trae TODOS los embarques que cumplen los filtros actuales (sin paginar).
      const todos = await fetchEmbarquesParaExport({
        organizationId,
        search: state.debouncedSearch,
        filterModo: state.filterModo,
        filterCliente: state.filterCliente,
        filterOperador: state.filterOperador,
        filterProforma: state.filterProforma,
        fechaDesde: state.fechaDesde || undefined,
        fechaHasta: state.fechaHasta || undefined,
      });

      // Filtro de estado se calcula client-side (no es columna directa de DB).
      const filtradosPorEstado = state.filterEstado === "todos"
        ? todos
        : todos.filter((e) => calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado) === state.filterEstado);

      if (filtradosPorEstado.length === 0) {
        notifyError(toast, { title: "Sin datos para exportar", description: "Los filtros actuales no devuelven embarques." });
        return;
      }

      // Trae estados de costos (liquidación) en chunks de 1000 IDs.
      const ids = filtradosPorEstado.map((e) => e.id);
      const liqMap: Record<string, { total: number; pagados: number }> = {};
      const CHUNK = 1000;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const extras = await fetchEmbarquesListExtras(slice);
        Object.assign(liqMap, extras.liquidacion);
      }

      exportToCsv(
        `embarques_${new Date().toISOString().slice(0, 10)}.csv`,
        [
          { key: "expediente", label: "Expediente" },
          { key: "bl_master", label: "BL Master" },
          { key: "cliente_nombre", label: "Cliente" },
          { key: "modo", label: "Modo" },
          { key: "tipo", label: "Tipo Operación" },
          { key: "origen", label: "Origen" },
          { key: "destino", label: "Destino" },
          { key: "estado", label: "Estado" },
          { key: "etd", label: "ETD" },
          { key: "eta", label: "ETA" },
          { key: "operador", label: "Operador" },
          { key: "contenedor", label: "Contenedor" },
          { key: "tipo_contenedor", label: "Tipo Contenedor" },
          { key: "descripcion_mercancia", label: "Descripción Mercancía" },
          { key: "tipo_cambio_usd", label: "T/C USD" },
          { key: "tipo_cambio_eur", label: "T/C EUR" },
          { key: "liquidacion", label: "Estado Costos" },
          { key: "created_at", label: "Fecha Creación" },
        ],
        filtradosPorEstado.map((e) => {
          const liq = liqMap[e.id];
          const estadoLiq = !liq || liq.total === 0 ? "—" : liq.pagados === liq.total ? "Pagado" : liq.pagados > 0 ? "Parcial" : "Pendiente";
          return {
            expediente: e.expediente,
            bl_master: e.bl_master || "",
            cliente_nombre: e.cliente_nombre,
            modo: e.modo,
            tipo: e.tipo,
            origen: getOrigen(e),
            destino: getDestino(e),
            estado: calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado),
            etd: e.etd || "",
            eta: e.eta || "",
            operador: e.operador || "",
            contenedor: e.contenedor || "",
            tipo_contenedor: e.tipo_contenedor || "",
            descripcion_mercancia: e.descripcion_mercancia || "",
            tipo_cambio_usd: e.tipo_cambio_usd ?? "",
            tipo_cambio_eur: e.tipo_cambio_eur ?? "",
            liquidacion: estadoLiq,
            created_at: e.created_at ? new Date(e.created_at).toLocaleDateString("es-MX") : "",
          };
        }),
      );

      notifySuccess(toast, {
        title: "CSV exportado",
        description: `${filtradosPorEstado.length} embarques exportados con los filtros actuales.`,
      });
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al exportar", description: getErrorMessage(err) });
    } finally {
      setExportandoCsv(false);
    }
  }, [organizationId, state.debouncedSearch, state.filterModo, state.filterCliente, state.filterOperador, state.filterProforma, state.filterEstado, state.fechaDesde, state.fechaHasta, toast]);

  return {
    // estado de filtros y paginación
    state,
    // datos
    clientes,
    operadoresUnicos,
    columns,
    isLoading,
    isEmptyState,
    // permisos
    canEdit,
    // dialogs
    embarqueAEliminar,
    setEmbarqueAEliminar,
    embarqueADuplicar,
    setEmbarqueADuplicar,
    // handlers
    handleEliminar,
    exportarCsv,
    exportandoCsv,
    eliminarEmbarquePending: eliminarEmbarque.isPending,
    // navegación
    navigate,
    prefetchEmbarque,
  };
}
