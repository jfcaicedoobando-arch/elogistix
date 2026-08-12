import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchExchangeRates } from "@/features/catalogos/services";

export function useExchangeRates() {
  return useQuery({
    queryKey: queryKeys.exchangeRates.all,
    queryFn: () => fetchExchangeRates(),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
    // UIA-08: degradación silenciosa. Sin TC la UI ya avisa ("TC no disponible",
    // hints de exclusión en Tesorería/Facturación); un fallo de este servicio de
    // background no es un fallo de carga de página y no debe disparar el toast global.
    meta: { silentError: true },
  });
}
