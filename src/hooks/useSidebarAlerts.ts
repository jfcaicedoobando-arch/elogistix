import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

export function useSidebarAlerts() {
  const { data } = useQuery({
    queryKey: queryKeys.sidebar.alertCounts,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('sidebar_alert_counts');
      if (error) throw error;
      const row = data?.[0] ?? { embarques_demora: 0, facturas_vencidas: 0 };
      return {
        embarquesDemora: Number(row.embarques_demora),
        facturasVencidas: Number(row.facturas_vencidas),
      };
    },
    staleTime: 60_000, // 1 min — no need to refresh alerts aggressively
  });

  const embarquesDemora = data?.embarquesDemora ?? 0;
  const facturasVencidas = data?.facturasVencidas ?? 0;

  return {
    totalAlertas: embarquesDemora + facturasVencidas,
    embarquesDemora,
    facturasVencidas,
  };
}
