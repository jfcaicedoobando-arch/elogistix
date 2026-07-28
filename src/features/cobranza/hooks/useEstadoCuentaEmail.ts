/**
 * useEstadoCuentaEmail — envía el estado de cuenta del cliente por email.
 *
 * QW12 Tanda 3 — Quick Wins facturación.
 */
import { useMutationWithFeedback } from "@/hooks/shared/useMutationWithFeedback";
import {
  enviarEstadoCuentaEmail,
  type EnviarEstadoCuentaInput,
  type EnviarEstadoCuentaResult,
} from "@/features/cobranza/services/estadoCuentaService";

;

export function useEstadoCuentaEmail(options?: { onSuccess?: () => void }) {
  return useMutationWithFeedback({
    mutationFn: enviarEstadoCuentaEmail,
    successTitle: "Estado de cuenta enviado",
    successDescription: "El cliente recibirá un resumen por correo.",
    errorTitle: "No se pudo enviar el estado de cuenta",
    errorMethod: "ENVIAR_ESTADO_CUENTA_EMAIL",
    onSuccess: options?.onSuccess,
  });
}
