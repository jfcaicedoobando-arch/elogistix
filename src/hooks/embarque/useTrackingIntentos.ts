import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchTrackingIntentos, type TrackingIntento } from "@/services/tracking/trackingIntentos";

export type { TrackingIntento };

const key = (id: string) => ["tracking_intentos", id];

export function useTrackingIntentos(embarqueId: string | undefined) {
  return useQuery({
    queryKey: key(embarqueId ?? ""),
    queryFn: () => fetchTrackingIntentos(embarqueId!),
    enabled: !!embarqueId,
    staleTime: 30 * 1000,
  });
}

export function useInvalidateTrackingIntentos(embarqueId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!embarqueId) return;
    qc.invalidateQueries({ queryKey: key(embarqueId) });
  }, [embarqueId, qc]);
}
