import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { createTrackingLink } from "@/services/tracking";

export function useCreateTrackingLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { embarqueId: string; expiresAt?: string | null }) =>
      createTrackingLink(params),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.trackingLinks.byEmbarque(data.embarque_id) });
    },
  });
}
