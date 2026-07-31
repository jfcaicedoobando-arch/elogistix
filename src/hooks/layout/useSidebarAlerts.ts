import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { fetchSidebarAlertCounts } from '@/features/reportes/services';
import { fetchAdminPendientesCount } from '@/features/embarques/services/cierre';

export function useSidebarAlerts() {
  const { data } = useQuery({
    queryKey: queryKeys.sidebar.alertCounts,
    queryFn: fetchSidebarAlertCounts,
    staleTime: 5 * 60_000, // 5 min — alertas no requieren refresco frecuente
    gcTime: 10 * 60_000,
  });

  // v13.89.0 — conteo de embarques con pendientes administrativos.
  // v13.380.1 — incluye Entregado / EIR / Por liquidar (ver embarques_admin_pendientes_count).
  const { data: adminPendientes = 0 } = useQuery({
    queryKey: queryKeys.sidebar.adminPendientes,
    queryFn: fetchAdminPendientesCount,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
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
