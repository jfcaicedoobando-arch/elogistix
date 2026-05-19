import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { exportToCsv } from "@/generators/exportCsv";
import { calcularEstadoEmbarque, usePrefetchEmbarque } from "@/hooks/embarque/useEmbarques";
import { useOperadoresDistintos } from "@/hooks/catalogos/useOperadoresDistintos";
import { useClientesForSelect } from "@/hooks/cliente/useClientes";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { getOrigen, getDestino } from "@/lib/formatters";
import { useEmbarquesPageState } from "@/hooks/embarque/useEmbarquesPageState";
import { buildEmbarqueColumns } from "@/components/embarque/embarqueColumns";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { fetchEmbarquesParaExport } from "@/services/embarque";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";

/**
 * Controller que centraliza estado, queries y handlers de la página de Embarques.
 * Mantiene la página enfocada únicamente en JSX/composición.
 *
 * v9.0.2: se eliminaron las acciones inline de editar/eliminar del listado;
 * la edición sólo está disponible desde el detalle del embarque.
 */
export function useEmbarquesPageController() {
  const navigate = useNavigate();
  const { data: clientes = [] } = useClientesForSelect();
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const prefetchEmbarque = usePrefetchEmbarque();

  const state = useEmbarquesPageState();
  const { isLoading, isEmptyState, contenedoresPorExpediente, extras } = state;

  const [exportandoCsv, setExportandoCsv] = useState(false);

  const { organizationId } = useOrgFilter();

  const { data: operadoresUnicos = [] } = useOperadoresDistintos();

  const docsMap = extras.docs;

  const columns = useMemo(
    () => buildEmbarqueColumns({
      docsMap,
      contenedoresPorExpediente,
    }),
    [docsMap, contenedoresPorExpediente],
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
          { key: "created_at", label: "Fecha Creación" },
        ],
        filtradosPorEstado.map((e) => ({
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
          created_at: e.created_at ? new Date(e.created_at).toLocaleDateString("es-MX") : "",
        })),
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
  }, [organizationId, state.debouncedSearch, state.filterModo, state.filterCliente, state.filterOperador, state.filterEstado, state.fechaDesde, state.fechaHasta, toast]);

  return {
    state,
    clientes,
    operadoresUnicos,
    columns,
    isLoading,
    isEmptyState,
    canEdit,
    exportarCsv,
    exportandoCsv,
    navigate,
    prefetchEmbarque,
  };
}
