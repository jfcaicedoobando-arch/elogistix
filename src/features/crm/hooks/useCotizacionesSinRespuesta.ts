import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  fetchCotizacionesSinRespuesta,
  type CotizacionSinRespuestaRow,
} from "@/features/crm/services/cotizacionesSinRespuesta";
import { queryKeys } from "@/lib/query";

export type { CotizacionSinRespuestaRow };

export function useCotizacionesSinRespuesta(diasUmbral = 5, limit = 10) {
  const { user } = useAuth();
  return useQuery<CotizacionSinRespuestaRow[]>({
    queryKey: queryKeys.crm.cotizacionesSinRespuesta(diasUmbral, limit, user?.id),
    enabled: !!user?.id,
    // Tanda 2 · hallazgo 1: tarjeta personal → sólo mi seguimiento.
    queryFn: () => fetchCotizacionesSinRespuesta(diasUmbral, limit, "todas", user?.id),
    staleTime: 60_000,
  });
}
