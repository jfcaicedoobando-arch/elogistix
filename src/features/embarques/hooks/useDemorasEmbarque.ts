import { getErrorMessage } from "@/lib/errors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifyInfo, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { calcularDemorasEmbarque, contarDemorasAuto, eliminarDemorasAuto } from "../services/demorasEmbarque";

import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";

/**
 * P2-4 — Conceptos `demoras_auto` realmente persistidos en el embarque.
 * Sirve para no ofrecer "Eliminar auto" cuando no hay nada que eliminar,
 * incluso tras recargar la página (el estado local se perdía).
 */
export function useDemorasAutoExistentes(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.demorasAutoExistentes(embarqueId),
    queryFn: () => contarDemorasAuto(embarqueId!),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });
}


export function useRecalcularDemoras(embarqueId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => calcularDemorasEmbarque(embarqueId!),
    onMutate: () => ({ embarqueId }),
    onSuccess: (data) => {
      // A8: claves vivas — 'embarque-detalle'/'conceptos-venta' (guion) no las
      // usa ninguna query; las reales son full(id)/conceptos_venta/conceptos_costo.
      qc.invalidateQueries({ queryKey: queryKeys.embarques.full(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.conceptosVenta(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.conceptosCosto(embarqueId) });
      if (data.sin_eventos) {
        notifyWarning(undefined, { title: "Faltan eventos de Descarga o Entrega en el timeline" });
      } else if (data.dias_excedidos === 0) {
        notifyInfo(undefined, { title: "No hay días excedidos: no se generaron demoras" });
      } else {
        notifySuccess(undefined, { title: `Demoras calculadas: ${data.dias_excedidos} días excedidos` });
      }
    },
    // A failure can follow materialization (partial deletion or a failed log).
    // Always re-read the affected shipment, including after navigation/errors.
    onSettled: (_data, _error, _variables, context) => {
      if (context?.embarqueId) {
        return qc.invalidateQueries({ queryKey: queryKeys.embarques.pnlFinanciero(context.embarqueId), exact: true });
      }
    },
    onError: (e: unknown) => {
      const msg = e && typeof e === "object" && "message" in e ? String(e.message) : getErrorMessage(e);
      if (msg.includes("LC_DEMORAS_MONEDAS_MIXTAS")) {
        notifyError(undefined, {
          title: "No se calcularon las demoras",
          description: "El tabulador mezcla monedas. Revisa Costeo → Navieras y usa una sola moneda por tipo de contenedor. No hay conversión automática; los cargos anteriores se conservan.",
          error: e,
          errorCode: "LC_DEMORAS_MONEDAS_MIXTAS",
          method: "FEATURES_EMBARQUES_HOOKS_USEDEMORASEMBARQUE_1",
        });
        return;
      }
      if (msg.includes("LC_DEMORAS_BLOQUEADAS")) {
        notifyError(undefined, {
          title: "No se pueden recalcular demoras",
          description:
            "Hay conceptos ya en proforma, facturados o vinculados a cuentas por pagar. Cancela primero la proforma / la CxP asociada e intenta de nuevo.",
          error: e,
          errorCode: "LC_DEMORAS_BLOQUEADAS",
          method: "FEATURES_EMBARQUES_HOOKS_USEDEMORASEMBARQUE_1",
        });
        return;
      }
      notifyError(undefined, { title: msg, error: e, method: "FEATURES_EMBARQUES_HOOKS_USEDEMORASEMBARQUE_1" });
    },
  });
}

export function useEliminarDemorasAuto(embarqueId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => eliminarDemorasAuto(embarqueId!),
    onMutate: () => ({ embarqueId }),
    onSuccess: () => {
      // A8: claves vivas — 'embarque-detalle'/'conceptos-venta' (guion) no las
      // usa ninguna query; las reales son full(id)/conceptos_venta/conceptos_costo.
      qc.invalidateQueries({ queryKey: queryKeys.embarques.full(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.conceptosVenta(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.conceptosCosto(embarqueId) });
      notifySuccess(undefined, { title: "Demoras automáticas eliminadas" });
    },
    // A failure can follow materialization (partial deletion or a failed log).
    // Always re-read the affected shipment, including after navigation/errors.
    onSettled: (_data, _error, _variables, context) => {
      if (context?.embarqueId) {
        return qc.invalidateQueries({ queryKey: queryKeys.embarques.pnlFinanciero(context.embarqueId), exact: true });
      }
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Error al eliminar";
      notifyError(undefined, { title: msg, error: e, method: "FEATURES_EMBARQUES_HOOKS_USEDEMORASEMBARQUE_2" });
    },
  });
}
