import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { useResponderCotizacion } from "@/hooks/cotizacion/mutations/usePortalCotizacionMutations";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export type RespuestaCotizacion = "Aceptada" | "Rechazada";

/**
 * Controller hook para PortalCotizacionDetalle.
 * Encapsula el estado de confirmación (acción + comentario) y la
 * orquestación de la mutación de respuesta (toasts + reset).
 */
export function usePortalCotizacionDetalleController(cotizacionId: string | undefined) {
  const { toast } = useToast();
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
          notifySuccess(toast, {
            title:
              confirmAction === "Aceptada"
                ? "Cotización aceptada exitosamente"
                : "Cotización rechazada"});
          reset();
        },
        onError: (err: unknown) => {
          notifyError(toast, {
            title: "Error",
            description: getErrorMessage(err)
          });
          reset();
        },
      },
    );
  }, [confirmAction, cotizacionId, comentario, responderMutation, toast, reset]);

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
