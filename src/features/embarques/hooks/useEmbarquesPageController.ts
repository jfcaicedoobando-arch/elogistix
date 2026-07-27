import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { exportToCsv } from "@/generators/exportCsv";
import { calcularEstadoEmbarque, usePrefetchEmbarque } from "@/features/embarques/hooks/useEmbarques";
import { useOperadoresDistintos } from "@/features/catalogos/hooks/useOperadoresDistintos";
import { useClientesForSelect } from "@/features/cliente/hooks/useClientes";
import { usePermissions } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import { getOrigen, getDestino } from "@/lib/formatters";
import { formatFechaEs } from "@/lib/formatters/dates";
import { useEmbarquesPageState } from "@/features/embarques/hooks/useEmbarquesPageState";
import { useContenedoresInfoMap } from "@/features/embarques/hooks/useContenedoresInfoMap";
import { buildEmbarqueColumns } from "@/features/embarques/table/embarqueColumns";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { fetchEmbarquesParaExport } from "@/features/embarques/services";
import { useOrgFilter } from "@/hooks/shared";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { todayLocalISO } from "@/lib/date/today";
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
  const prefetchEmbarque = usePrefetchEmbarque();

  const state = useEmbarquesPageState();
  const { isLoading, isError, refetch, isEmptyState, contenedoresPorExpediente, extras, embarques } = state;

  const visibleIds = useMemo(() => embarques.map((e) => e.id), [embarques]);
  const { data: contenedoresInfoMap = {} } = useContenedoresInfoMap(visibleIds);

  const [exportandoCsv, setExportandoCsv] = useState(false);

  const { organizationId } = useOrgFilter();

  const { data: operadoresUnicos = [] } = useOperadoresDistintos();

  const docsMap = extras.docs;

  const columns = useMemo(
    () => buildEmbarqueColumns({
      docsMap,
      contenedoresPorExpediente,
      contenedoresInfoMap,
    }),
    [docsMap, contenedoresPorExpediente, contenedoresInfoMap],
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
        : todos.filter((e) => calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado, e.fecha_llegada_real) === state.filterEstado);

      // Filtro de alerta también es client-side (se resuelve contra un set de IDs).
      const filtradosFinal = state.filterAlerta === "todos" || !state.alertIdSet
        ? filtradosPorEstado
        : filtradosPorEstado.filter((e) => state.alertIdSet!.has(e.id));

      if (filtradosFinal.length === 0) {
        notifyError(undefined, { title: "Sin datos para exportar", description: "Los filtros actuales no devuelven embarques.", method: "USE_EMBARQUES_PAGE_CONTROLLER", errorCode: ERROR_CODES.VALIDATION_FAILED });
        return;
      }

      exportToCsv(
        `embarques_${todayLocalISO()}.csv`,
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
        filtradosFinal.map((e) => ({
          expediente: e.expediente,
          bl_master: e.bl_master || "",
          cliente_nombre: e.cliente_nombre,
          modo: e.modo,
          tipo: e.tipo,
          origen: getOrigen(e),
          destino: getDestino(e),
          estado: calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado, e.fecha_llegada_real),
          etd: e.etd || "",
          eta: e.eta || "",
          operador: e.operador || "",
          contenedor: e.contenedor || "",
          tipo_contenedor: e.tipo_contenedor || "",
          descripcion_mercancia: e.descripcion_mercancia || "",
          tipo_cambio_usd: e.tipo_cambio_usd ?? "",
          tipo_cambio_eur: e.tipo_cambio_eur ?? "",
          created_at: e.created_at ? formatFechaEs(e.created_at) : "",
        })),
      );

      notifySuccess(undefined, {
        title: "CSV exportado",
        description: `${filtradosFinal.length} embarques exportados con los filtros actuales.`,
      });
    } catch (err: unknown) {
      notifyError(undefined, { title: "Error al exportar", description: getErrorMessage(err), error: err, method: "USE_EMBARQUES_PAGE_CONTROLLER" });
    } finally {
      setExportandoCsv(false);
    }
  }, [organizationId, state.debouncedSearch, state.filterModo, state.filterCliente, state.filterOperador, state.filterEstado, state.filterAlerta, state.alertIdSet, state.fechaDesde, state.fechaHasta]);

  return {
    state,
    clientes,
    operadoresUnicos,
    columns,
    isLoading,
    isError,
    refetch,
    isEmptyState,
    canEdit,
    exportarCsv,
    exportandoCsv,
    navigate,
    prefetchEmbarque,
  };
}
