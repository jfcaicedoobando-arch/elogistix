import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { createTrackingLink, deleteTrackingLink, fetchTrackingLinks } from "@/features/embarques/services/tracking";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

export function useTrackingLinks(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.trackingLinks.byEmbarque(embarqueId),
    queryFn: () => fetchTrackingLinks(embarqueId!),
    enabled: !!embarqueId,
  });
}

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
      notifyError(undefined, { title: "No se pudo crear liga de tracking", description: getErrorMessage(error), error, method: "CREATE_TRACKING_LINK" });
    },
  });
}

export function useDeleteTrackingLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { linkId: string; embarqueId: string }) =>
      deleteTrackingLink(params),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.trackingLinks.byEmbarque(vars.embarqueId) });
      notifySuccess(undefined, { title: "Liga de tracking revocada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo revocar la liga", description: getErrorMessage(error), error, method: "DELETE_TRACKING_LINK" });
    },
  });
}
