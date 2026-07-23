import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { createTrackingLink } from "@/features/embarques/services/tracking";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export function useCreateTrackingLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { embarqueId: string; expiresAt?: string | null }) =>
      createTrackingLink(params),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.trackingLinks.byEmbarque(data.embarque_id) });
      notifySuccess(undefined, { title: "Liga de tracking generada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear liga de tracking: ${error.message}`, error, method: "CREATE_TRACKING_LINK" });
    },
  });
}
