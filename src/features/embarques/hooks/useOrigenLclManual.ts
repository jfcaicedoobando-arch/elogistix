import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchOrigenLclManual } from "@/features/embarques/services/origenLclManual";

export function useOrigenLclManual(cotizacionId: string) {
  return useQuery({
    queryKey: queryKeys.cotizaciones.origenLcl(cotizacionId),
    queryFn: () => fetchOrigenLclManual(cotizacionId),
    staleTime: 60_000,
  });
}
