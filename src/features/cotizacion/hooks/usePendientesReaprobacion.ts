/**
 * Conteo de cotizaciones pendientes de re-aprobación de tarifa (Fase 1).
 *
 * - Global: todas las cotizaciones del tenant en `estado_revalidacion =
 *   'pendiente_reaprobacion'` (dashboard de operaciones).
 * - Mías: filtradas por `operador = <email actual>` (dashboard comercial).
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
import { queryKeys } from "@/lib/query";
  contarCotizacionesPendientesReaprobacion,
  contarMisCotizacionesPendientesReaprobacion,
} from "@/features/cotizacion/services/pendientesReaprobacion";

export function useCotizacionesPendientesReaprobacion() {
  return useQuery<number>({
    queryKey: queryKeys.cotizaciones.pendientesReaprobacion.all,
    staleTime: 60_000,
    queryFn: () => contarCotizacionesPendientesReaprobacion(),
  });
}

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
