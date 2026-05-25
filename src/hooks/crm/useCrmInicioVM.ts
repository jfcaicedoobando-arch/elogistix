/**
 * View-model del Inicio del CRM. Centraliza defaults y mapping a las cards.
 */
import {
  useCrmDashboardData,
  useActividadesVencidasList,
  useCotizacionesSinRespuesta,
  useNextBestActions,
} from "@/hooks/crm";

export function useCrmInicioVM() {
  const { data, isLoading } = useCrmDashboardData();
  const { data: vencidas = [] } = useActividadesVencidasList(5);
  const { data: cotsSinResp = [] } = useCotizacionesSinRespuesta(5, 5);
  const { items: nba, isLoading: nbaLoading } = useNextBestActions(5);

  return {
    isLoading,
    vencidas,
    cotsSinResp,
    nba,
    nbaLoading,
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
