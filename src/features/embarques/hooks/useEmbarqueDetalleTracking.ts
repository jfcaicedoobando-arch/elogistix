import { useCreateTrackingLink } from "@/features/embarques/hooks/useTrackingLinks";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
/**
 * Encapsula la creación y copiado al portapapeles del enlace público
 * de tracking para un embarque dado.
 */
export function useEmbarqueDetalleTracking(embarqueId: string | undefined) {
  const createTrackingLink = useCreateTrackingLink();

  const handleCompartirTracking = async () => {
    if (!embarqueId) return;
    try {
      const link = await createTrackingLink.mutateAsync({ embarqueId });
      const url = `${window.location.origin}/tracking/${link.token}`;
      await navigator.clipboard.writeText(url);
      notifySuccess(undefined, { title: "Enlace copiado", description: "El enlace de tracking fue copiado al portapapeles." });
    } catch {
      notifyError(undefined, { title: "Error al generar enlace", method: "HANDLE_COMPARTIR_TRACKING", errorCode: ERROR_CODES.VALIDATION_FAILED });
    }
  };

  return {
    handleCompartirTracking,
    isPending: createTrackingLink.isPending,
  };
}
