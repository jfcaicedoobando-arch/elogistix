import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { calcularDemorasEmbarque, eliminarDemorasAuto } from "../services/demorasEmbarque";

import { notifyError } from "@/components/shared/utils/appFeedback";
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
        toast.warning("Faltan eventos de Descarga o Entrega en el timeline");
      } else if (data.dias_excedidos === 0) {
        toast.info("No hay días excedidos: no se generaron demoras");
      } else {
        toast.success(`Demoras calculadas: ${data.dias_excedidos} días excedidos`);
      }
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Error al calcular demoras";
      if (msg.includes("LC_DEMORAS_BLOQUEADAS")) {
        toast.error("No se pueden recalcular demoras", {
          description:
            "Hay conceptos ya en proforma, facturados o vinculados a cuentas por pagar. Cancela primero la proforma / la CxP asociada e intenta de nuevo.",
        });
        return;
      }
      notifyError(toast, { title: msg, error: e, method: "FEATURES_EMBARQUES_HOOKS_USEDEMORASEMBARQUE_1" });
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
      toast.success("Demoras automáticas eliminadas");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Error al eliminar";
      notifyError(toast, { title: msg, error: e, method: "FEATURES_EMBARQUES_HOOKS_USEDEMORASEMBARQUE_2" });
    },
  });
}
