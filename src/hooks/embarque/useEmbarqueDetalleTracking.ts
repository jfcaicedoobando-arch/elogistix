import { useCreateTrackingLink } from "@/hooks/useTrackingLinks";
import { useToast } from "@/hooks/use-toast";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

/**
 * Encapsula la creación y copiado al portapapeles del enlace público
 * de tracking para un embarque dado.
 */
export function useEmbarqueDetalleTracking(embarqueId: string | undefined) {
  const createTrackingLink = useCreateTrackingLink();
  const { toast } = useToast();

  const handleCompartirTracking = async () => {
    if (!embarqueId) return;
    try {
      const link = await createTrackingLink.mutateAsync({ embarqueId });
      const url = `${window.location.origin}/tracking/${link.token}`;
      await navigator.clipboard.writeText(url);
      notifySuccess(toast, { title: "Enlace copiado", description: "El enlace de tracking fue copiado al portapapeles." });
    } catch {
      notifyError(toast, { title: "Error al generar enlace" });
    }
  };

  return {
    handleCompartirTracking,
    isPending: createTrackingLink.isPending,
  };
}
