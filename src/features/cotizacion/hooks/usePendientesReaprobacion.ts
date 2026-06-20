/**
 * Conteo de cotizaciones pendientes de re-aprobación de tarifa (Fase 1).
 *
 * - Global: todas las cotizaciones del tenant en `estado_revalidacion =
 *   'pendiente_reaprobacion'` (dashboard de operaciones).
 * - Mías: filtradas por `operador = <email actual>` (dashboard comercial).
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  contarCotizacionesPendientesReaprobacion,
  contarMisCotizacionesPendientesReaprobacion,
} from "@/features/cotizacion/services/pendientesReaprobacion";

export function useCotizacionesPendientesReaprobacion() {
  return useQuery<number>({
    queryKey: ["cotizaciones", "pendientes-reaprobacion", "all"],
    staleTime: 60_000,
    queryFn: () => contarCotizacionesPendientesReaprobacion(),
  });
}

export function useMisCotizacionesPendientesReaprobacion() {
  const { user } = useAuth();
  const email = user?.email ?? null;
  return useQuery<number>({
    queryKey: ["cotizaciones", "pendientes-reaprobacion", "mias", email],
    enabled: Boolean(email),
    staleTime: 60_000,
    queryFn: () => contarMisCotizacionesPendientesReaprobacion(email as string),
  });
}
