/**
 * useConsultarRep — refresco manual del estatus de cancelación de un REP.
 * Pregunta a FacturApi/SAT en vivo y sincroniza la BD si difiere, sin esperar
 * el cron de reconciliación (cada 30 min).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { consultarEstadoRep, type ConsultarRepResult } from "@/features/facturacion/services/repConsultar";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { invalidarTrasRep } from "./invalidarRep";

const ETIQUETA: Record<string, string> = {
  accepted: "El SAT aceptó la cancelación del REP.",
  rejected: "El receptor rechazó la cancelación del REP.",
  expired: "La solicitud de cancelación expiró.",
  pending: "El SAT sigue verificando la cancelación.",
  verifying: "El SAT sigue verificando la cancelación.",
};

export function useConsultarRep(facturaId?: string) {
  const qc = useQueryClient();
  return useMutation<ConsultarRepResult, Error, string>({
    mutationFn: (pagoId: string) => consultarEstadoRep(pagoId),
    onSuccess: (res) => {
      invalidarTrasRep(qc, facturaId);
      const detalle = ETIQUETA[res.remoto.cancellation_status] ?? `Estado en el SAT: ${res.remoto.cancellation_status}.`;
      if (res.actualizado) {
        notifySuccess(undefined, { title: "Estado del REP actualizado", description: detalle });
        return;
      }
      notifyInfo(undefined, { title: "Sin cambios en el SAT", description: detalle });
    },
    onError: (err) =>
      notifyError(undefined, {
        title: "No se pudo consultar el estado del REP",
        description: getErrorMessage(err),
        error: err,
        method: "FEATURES_FACTURACION_HOOKS_USECONSULTARREP_1",
      }),
  });
}
