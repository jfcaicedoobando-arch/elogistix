import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchTrackingLinks,
  createTrackingLink,
  deleteTrackingLink,
} from "@/services/trackingService";

export function useTrackingLinks(embarqueId?: string) {
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
    },
  });
}

export function useDeleteTrackingLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, embarqueId }: { id: string; embarqueId: string }) => {
      await deleteTrackingLink(id);
      return embarqueId;
    },
    onSuccess: (embarqueId) => {
      qc.invalidateQueries({ queryKey: queryKeys.trackingLinks.byEmbarque(embarqueId) });
    },
  });
}
