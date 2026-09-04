/**
 * Contadores de los badges de alerta del sidebar.
 *
 * Rendimiento (auditoría Cloud 2026-08-06, punto 3): `sidebar_alert_counts()`
 * se ejecutaba ~11.3k veces (≈21 ms cada una) porque el sidebar se monta en
 * cada ruta y el `staleTime` de 5 min dejaba pasar un refetch por navegación
 * tras ese lapso. Estos contadores son de granularidad diaria (demoras,
 * facturas vencidas, garantías atoradas): no aportan nada refrescarlos cada
 * pocos minutos.
 *
 * Estrategia:
 * - `staleTime` VERY_LONG (30 min) en lugar de 5 min.
 * - `gcTime` 60 min: el dato sobrevive a desmontajes de layout, así que
 *   navegar por la app no dispara consultas nuevas.
 * - `refetchOnMount: false`: si el dato está en caché (aunque esté stale) el
 *   badge se pinta al instante sin pegarle a la base.
 *
 * Para forzar un refresco tras una mutación relevante, usar
 * `invalidateSidebarAlerts(queryClient)`.
 */
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { staleTimes } from '@/lib/query/staleTimes';
import { fetchSidebarAlertCounts } from '@/features/reportes/services';
import { fetchAdminPendientesCount } from '@/features/embarques/services/cierre';
import { useAuth } from '@/lib/contexts/AuthContext';

const SIDEBAR_QUERY_TUNING = {
  staleTime: staleTimes.VERY_LONG,
  gcTime: 60 * 60_000,
  refetchOnMount: false,
  // A12 (Ola 7): red de seguridad. Las mutaciones relevantes invalidan estos
  // contadores, pero un cambio hecho por otro usuario (o por un cron) dejaba
  // el badge congelado. PERF (auditoría 2026-08-18, hallazgo #2): 5 min seguía
  // costando 775 llamadas / 16.6 s acumulados sobre datos de granularidad
  // DIARIA (demoras, vencidas, garantías). 30 min alinea el intervalo con el
  // `staleTime` y con la naturaleza del dato.
  refetchInterval: 30 * 60_000,
  refetchIntervalInBackground: false,
} as const;

/** Invalida los badges del sidebar para que se recalculen en el próximo render. */
export function invalidateSidebarAlerts(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.sidebar.alertCounts });
  void queryClient.invalidateQueries({ queryKey: queryKeys.sidebar.adminPendientes });
}

export function useSidebarAlerts() {
  // Sentry JAVASCRIPT-REACT-5X: en /login (sesión anónima) estos contadores se
  // ejecutaban igual y la RPC, que sólo tiene EXECUTE para `authenticated`,
  // fallaba con "permission denied". Sin sesión no hay badges que pintar.
  const { user } = useAuth();
  const conSesion = Boolean(user);

  const { data } = useQuery({
    queryKey: queryKeys.sidebar.alertCounts,
    queryFn: fetchSidebarAlertCounts,
    enabled: conSesion,
    ...SIDEBAR_QUERY_TUNING,
  });

  // v13.89.0 — conteo de embarques con pendientes administrativos.
  // v13.380.1 — incluye Entregado / EIR / Por liquidar (ver embarques_admin_pendientes_count).
  const { data: adminPendientes = 0 } = useQuery({
    queryKey: queryKeys.sidebar.adminPendientes,
    queryFn: fetchAdminPendientesCount,
    enabled: conSesion,
    ...SIDEBAR_QUERY_TUNING,
  });

  const embarquesDemora = data?.embarquesDemora ?? 0;
  const facturasVencidas = data?.facturasVencidas ?? 0;
  const garantiasAtoradas = data?.garantiasAtoradas ?? 0;

  return {
    totalAlertas: embarquesDemora + facturasVencidas + garantiasAtoradas + adminPendientes,
    embarquesDemora,
    facturasVencidas,
    garantiasAtoradas,
    adminPendientes,
  };
}
