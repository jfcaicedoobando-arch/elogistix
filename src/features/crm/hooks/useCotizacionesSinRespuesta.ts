import { useQuery } from "@tanstack/react-query";
import {
  fetchCotizacionesSinRespuesta,
  type CotizacionSinRespuestaRow,
} from "@/features/crm/services/cotizacionesSinRespuesta";
import { queryKeys } from "@/lib/query";

export type { CotizacionSinRespuestaRow };

export function useCotizacionesSinRespuesta(diasUmbral = 5, limit = 10) {
  return useQuery<CotizacionSinRespuestaRow[]>({
    queryKey: queryKeys.crm.cotizacionesSinRespuesta(diasUmbral, limit),
    queryFn: () => fetchCotizacionesSinRespuesta(diasUmbral, limit),
    staleTime: 60_000,
  });
}
