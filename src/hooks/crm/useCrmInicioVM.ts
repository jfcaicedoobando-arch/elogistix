/**
 * View-model del Inicio del CRM. Centraliza defaults y mapping a las cards.
 */
import { useCrmDashboardData, useActividadesVencidasList } from "@/hooks/crm";

export function useCrmInicioVM() {
  const { data, isLoading } = useCrmDashboardData();
  const { data: vencidas = [] } = useActividadesVencidasList(5);

  return {
    isLoading,
    vencidas,
    actividadesHoy: data?.misActividadesHoy ?? [],
    cerrandoSemana: data?.cerrandoEstaSemana ?? [],
    leadsSinContactar: data?.leadsSinContactar ?? [],
    topDeals: data?.topDeals ?? [],
    kpis: {
      leads: data?.kpis.leads,
      oportunidadesAbiertas: data?.kpis.oportunidadesAbiertas,
      actividadesPendientes: data?.kpis.actividadesPendientes,
      pipelinePonderado: data?.kpis.pipelinePonderado ?? 0,
    },
  };
}
