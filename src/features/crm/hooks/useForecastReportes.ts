/**
 * Reportes y forecast CRM. Toda la I/O vive en `services/crm/forecast`.
 * La derivación pura vive en `lib/crm/forecast`.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchForecast,
  fetchEtapasAnalitica,
  fetchReportesCRM,
  type ForecastResumen,
  type ReportesCRM,
} from "@/features/crm/services/forecast";

export type { ForecastResumen, ReportesCRM };

const etapasAnaliticaQuery = {
  queryKey: queryKeys.crm.etapas.analitica,
  queryFn: fetchEtapasAnalitica,
  // The owning panel retries the whole read; nested retries multiply requests.
  retry: false,
  meta: { silentError: true },
};

export function useForecast(desde?: string, hasta?: string) {
  const queryClient = useQueryClient();
  return useQuery<ForecastResumen>({
    queryKey: queryKeys.crm.forecast(desde ?? "", hasta ?? ""),
    queryFn: () => fetchForecast(desde, hasta, queryClient.fetchQuery(etapasAnaliticaQuery)),
  });
}

export function useReportesCRM() {
  const queryClient = useQueryClient();
  return useQuery<ReportesCRM>({
    queryKey: queryKeys.crm.reportes,
    queryFn: () => fetchReportesCRM(queryClient.fetchQuery(etapasAnaliticaQuery)),
  });
}
