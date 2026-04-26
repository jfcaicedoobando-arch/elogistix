import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { exportToCsv } from "@/generators/exportCsv";
import { useEliminarEmbarque, calcularEstadoEmbarque, usePrefetchEmbarque } from "@/hooks/useEmbarques";
import type { EmbarqueRow } from "@/hooks/useEmbarques";
import { useOperadoresDistintos } from "@/hooks/useOperadoresDistintos";
import { useClientesForSelect } from "@/hooks/useClientes";
import { usePermissions } from "@/hooks/usePermissions";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { getOrigen, getDestino } from "@/lib/formatters";
import { useEmbarquesListExtras } from "@/hooks/embarque/useEmbarquesListData";
import { useEmbarquesPageState } from "@/hooks/embarque/useEmbarquesPageState";
import { buildEmbarqueColumns } from "@/components/embarque/embarqueColumns";

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
  const { embarques, filtered, isLoading, isEmptyState } = state;

  const [embarqueAEliminar, setEmbarqueAEliminar] = useState<EmbarqueRow | null>(null);
  const [embarqueADuplicar, setEmbarqueADuplicar] = useState<EmbarqueRow | null>(null);

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
      toast({ title: "Embarque eliminado", description: `${expediente} fue eliminado permanentemente.` });
    } catch (err: unknown) {
      toast({ title: "Error al eliminar", description: getErrorMessage(err), variant: "destructive" });
    }
    setEmbarqueAEliminar(null);
  }, [embarqueAEliminar, eliminarEmbarque, registrarActividad, toast]);

  const columns = useMemo(
    () => buildEmbarqueColumns({
      canEdit,
      docsMap,
      liquidacionMap,
      onEditar: (e) => navigate(`/embarques/${e.id}/editar`),
      onDuplicar: setEmbarqueADuplicar,
      onEliminar: setEmbarqueAEliminar,
    }),
    [canEdit, liquidacionMap, docsMap, navigate],
  );

  const exportarCsv = useCallback(() => {
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
      filtered.map(e => {
        const liq = liquidacionMap[e.id];
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
  }, [filtered, liquidacionMap]);

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
    eliminarEmbarquePending: eliminarEmbarque.isPending,
    // navegación
    navigate,
    prefetchEmbarque,
  };
}
