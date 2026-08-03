import { useState, useCallback } from "react";
import { getErrorMessage } from "@/lib/errors";
import { useResponderCotizacion } from "@/features/cotizacion/hooks/mutations/usePortalCotizacionMutations";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { formatFechaHoraTexto } from "@/lib/formatters/dates";
export type RespuestaCotizacion = "Aceptada" | "Rechazada";

/**
 * Controller hook para PortalCotizacionDetalle.
 * Encapsula el estado de confirmación (acción + comentario) y la
 * orquestación de la mutación de respuesta (toasts + reset).
 */
export function usePortalCotizacionDetalleController(cotizacionId: string | undefined) {
  const [confirmAction, setConfirmAction] = useState<RespuestaCotizacion | null>(null);
  const [comentario, setComentario] = useState("");
  const responderMutation = useResponderCotizacion(cotizacionId ?? "");

  const reset = useCallback(() => {
    setConfirmAction(null);
    setComentario("");
  }, []);

  const handleResponder = useCallback(() => {
    if (!confirmAction || !cotizacionId) return;
    responderMutation.mutate(
      { respuesta: confirmAction, comentario },
      {
        onSuccess: () => {
          const fechaTxt = formatFechaHora(new Date().toISOString());
          notifySuccess(undefined, {
            title:
              confirmAction === "Aceptada"
                ? "Tu respuesta fue registrada"
                : "Cotización rechazada",
            description:
              confirmAction === "Aceptada"
                ? `Aceptaste la cotización el ${fechaTxt}. El equipo de Libre Carga ha sido notificado y dará seguimiento.`
                : `Registramos tu rechazo el ${fechaTxt}. El equipo de operaciones podrá contactarte si necesitas una nueva propuesta.`,
          });
          reset();
        },
        onError: (err: unknown) => {
          notifyError(undefined, {
            title: "Error",
            description: getErrorMessage(err),
            method: "ON_ERROR",
            errorCode: ERROR_CODES.VALIDATION_FAILED,
          });
          reset();
        },
      },
    );
  }, [confirmAction, cotizacionId, comentario, responderMutation, reset]);

  const onDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) reset();
    },
    [reset],
  );

  return {
    confirmAction,
    setConfirmAction,
    comentario,
    setComentario,
    handleResponder,
    onDialogOpenChange,
    isPending: responderMutation.isPending,
  };
}
