import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchExchangeRates } from "@/features/catalogos/services";

/**
 * @param fecha ISO `YYYY-MM-DD` opcional (B-03). Si se provee, la query se keyea
 *   por fecha y la edge devuelve la Publicación DOF vigente ESE día, en vez del
 *   TC de hoy. Úsala para valuar documentos/pagos con fecha pasada.
 */
export function useExchangeRates(fecha?: string) {
  return useQuery({
    queryKey: fecha ? [...queryKeys.exchangeRates.all, fecha] : queryKeys.exchangeRates.all,
    queryFn: () => fetchExchangeRates(fecha),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
    // UIA-08: degradación silenciosa. Sin TC la UI ya avisa ("TC no disponible",
    // hints de exclusión en Tesorería/Facturación); un fallo de este servicio de
    // background no es un fallo de carga de página y no debe disparar el toast global.
    meta: { silentError: true },
  });
}
