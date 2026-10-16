/**
 * Conteo de cotizaciones propias pendientes de re-aprobación de tarifa.
 * Filtradas por `operador = <email actual>` (dashboard comercial).
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  contarMisCotizacionesPendientesReaprobacion,
} from "@/features/cotizacion/services/pendientesReaprobacion";
import { queryKeys } from "@/lib/query";

export function useMisCotizacionesPendientesReaprobacion() {
  const { user } = useAuth();
  const email = user?.email ?? null;
  return useQuery<number>({
    queryKey: queryKeys.cotizaciones.pendientesReaprobacion.mias(email),
    enabled: Boolean(email),
    staleTime: 60_000,
    queryFn: () => contarMisCotizacionesPendientesReaprobacion(email as string),
  });
}
