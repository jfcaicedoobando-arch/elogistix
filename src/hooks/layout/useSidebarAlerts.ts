import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { fetchSidebarAlertCounts } from '@/features/reportes/services';

export function useSidebarAlerts() {
  const { data } = useQuery({
    queryKey: queryKeys.sidebar.alertCounts,
    queryFn: fetchSidebarAlertCounts,
    staleTime: 5 * 60_000, // 5 min — alertas no requieren refresco frecuente
    gcTime: 10 * 60_000,
  });

  const embarquesDemora = data?.embarquesDemora ?? 0;
  const facturasVencidas = data?.facturasVencidas ?? 0;
  const garantiasAtoradas = data?.garantiasAtoradas ?? 0;

  return {
    totalAlertas: embarquesDemora + facturasVencidas + garantiasAtoradas,
    embarquesDemora,
    facturasVencidas,
    garantiasAtoradas,
  };
}
