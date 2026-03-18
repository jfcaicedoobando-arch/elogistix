import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmbarques, calcularEstadoEmbarque } from '@/hooks/useEmbarques';

const DIAS_LIBRES_DEFAULT = 7;

export function useSidebarAlerts() {
  const { data: embarques = [] } = useEmbarques();

  const { data: facturasVencidas = 0 } = useQuery({
    queryKey: ['sidebar-facturas-vencidas'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('facturas')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'Vencida');
      if (error) throw error;
      return count ?? 0;
    },
  });

  const embarquesDemora = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return embarques.filter((e) => {
      const estado = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
      if (estado !== 'Arribo' || !e.eta) return false;
      const eta = new Date(e.eta + 'T00:00:00');
      const diasDesdeEta = Math.floor((hoy.getTime() - eta.getTime()) / 864e5);
      return diasDesdeEta - DIAS_LIBRES_DEFAULT >= 0;
    }).length;
  }, [embarques]);

  return {
    totalAlertas: embarquesDemora + facturasVencidas,
    embarquesDemora,
    facturasVencidas,
  };
}
