import { useQuery } from "@tanstack/react-query";
import {
  fetchCotizacionesSinRespuesta,
  type CotizacionSinRespuestaRow,
} from "@/features/crm/services/cotizacionesSinRespuesta";

export type { CotizacionSinRespuestaRow };

export function useCotizacionesSinRespuesta(diasUmbral = 5, limit = 10) {
  return useQuery<CotizacionSinRespuestaRow[]>({
    queryKey: ["crm", "cotizaciones-sin-respuesta", diasUmbral, limit],
    queryFn: () => fetchCotizacionesSinRespuesta(diasUmbral, limit),
    staleTime: 60_000,
  });
}
