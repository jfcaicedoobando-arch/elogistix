/**
 * Hook del libro maestro de pagos (Tesorería → Pagos).
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchLibroPagos } from "@/features/tesoreria/services/libroPagos";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";

export function useLibroPagos(desde: string, hasta: string) {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: [...queryKeys.tesoreria.libroPagos(desde, hasta), organizationId],
    queryFn: () => fetchLibroPagos(desde, hasta, organizationId),
    enabled: !!desde && !!hasta,
    staleTime: 30_000,
  });
}
