/**
 * Reportes y forecast CRM. Toda la I/O vive en `services/crm/forecast`.
 * La derivación pura vive en `lib/crm/forecast`.
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchForecast,
  fetchReportesCRM,
  type ForecastResumen,
  type ReportesCRM,
} from "@/services/crm/forecast";

export type { ForecastResumen, ReportesCRM };

export function useForecast(desde?: string, hasta?: string) {
  return useQuery<ForecastResumen>({
    queryKey: queryKeys.crm.forecast(desde ?? "", hasta ?? ""),
    queryFn: () => fetchForecast(desde, hasta),
  });
}

export function useReportesCRM() {
  return useQuery<ReportesCRM>({
    queryKey: queryKeys.crm.reportes,
    queryFn: () => fetchReportesCRM(),
  });
}
