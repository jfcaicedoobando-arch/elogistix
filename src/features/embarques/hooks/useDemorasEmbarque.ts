import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifyInfo, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { calcularDemorasEmbarque, eliminarDemorasAuto } from "../services/demorasEmbarque";

import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
export function useRecalcularDemoras(embarqueId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => calcularDemorasEmbarque(embarqueId!),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.embarques.detalle(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.conceptosVentaDash(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.conceptosCostoDash(embarqueId) });
      if (data.sin_eventos) {
        notifyWarning(undefined, { title: "Faltan eventos de Descarga o Entrega en el timeline" });
      } else if (data.dias_excedidos === 0) {
        notifyInfo(undefined, { title: "No hay días excedidos: no se generaron demoras" });
      } else {
        notifySuccess(undefined, { title: `Demoras calculadas: ${data.dias_excedidos} días excedidos` });
      }
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Error al calcular demoras";
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.embarques.detalle(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.conceptosVentaDash(embarqueId) });
      qc.invalidateQueries({ queryKey: queryKeys.embarques.conceptosCostoDash(embarqueId) });
      notifySuccess(undefined, { title: "Demoras automáticas eliminadas" });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Error al eliminar";
      notifyError(undefined, { title: msg, error: e, method: "FEATURES_EMBARQUES_HOOKS_USEDEMORASEMBARQUE_2" });
    },
  });
}
