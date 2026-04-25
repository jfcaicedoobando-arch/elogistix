import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { fetchExchangeRates } from "@/services/catalogosService";

export function useExchangeRates() {
  return useQuery({
    queryKey: queryKeys.exchangeRates.all,
    queryFn: fetchExchangeRates,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });
}
