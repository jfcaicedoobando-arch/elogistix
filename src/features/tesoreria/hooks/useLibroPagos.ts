/**
 * Hook del libro maestro de pagos (Tesorería → Pagos).
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchLibroPagos } from "@/features/tesoreria/services/libroPagos";

export function useLibroPagos(desde: string, hasta: string) {
  return useQuery({
    queryKey: queryKeys.tesoreria.libroPagos(desde, hasta),
    queryFn: () => fetchLibroPagos(desde, hasta),
    enabled: !!desde && !!hasta,
    staleTime: 30_000,
  });
}
