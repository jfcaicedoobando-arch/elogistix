/**
 * Wrapper hook para la página /tracking/:token.
 * Mantiene `useQuery` fuera de la capa de páginas (regla Page → hook → service).
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchTrackingPublico, type TrackingPublicoData } from "@/services/tracking";

export function useTrackingPublicoPage(token: string | undefined) {
  return useQuery<TrackingPublicoData>({
    queryKey: queryKeys.trackingPublico(token ?? ""),
    queryFn: () => fetchTrackingPublico(token!),
    enabled: !!token,
    retry: false,
  });
}
