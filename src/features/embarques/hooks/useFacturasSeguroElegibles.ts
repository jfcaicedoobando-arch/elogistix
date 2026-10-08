import { useQuery } from "@tanstack/react-query";
import { fetchFacturasSeguroElegibles } from "@/features/embarques/services/seguros";
import { queryKeys } from "@/lib/query";

export function useFacturasSeguroElegibles(embarqueId: string) {
  return useQuery({
    queryKey: queryKeys.embarques.segurosFacturasElegibles(embarqueId),
    queryFn: () => fetchFacturasSeguroElegibles(embarqueId),
    staleTime: 30_000,
  });
}
