/**
 * View-model del Inicio del CRM. Centraliza defaults y mapping a las cards.
 *
 * 11.49.0: removida `vencidas` independiente (VencidasAlert eliminado —
 * las vencidas ya son la regla #1 dentro de NextBestActions, prioridad ≥110).
 */
import {
  useCrmDashboardData,
  useCotizacionesSinRespuesta,
  useNextBestActions,
} from "@/features/crm/hooks";

export function useCrmInicioVM() {
  const { data, isLoading, isError, refetch } = useCrmDashboardData();
  const { data: cotsSinResp = [], isError: cotsError, refetch: cotsRefetch } = useCotizacionesSinRespuesta(5, 5);
  const { items: nba, isLoading: nbaLoading, isError: nbaError, refetch: nbaRefetch } = useNextBestActions(5);

  return {
    isLoading,
    isError,
    refetch,
    cotsSinResp,
    cotsError,
    cotsRefetch,
    nba,
    nbaLoading,
    nbaError,
    nbaRefetch,
    actividadesHoy: data?.misActividadesHoy ?? [],
    cerrandoSemana: data?.cerrandoEstaSemana ?? [],
    leadsSinContactar: data?.leadsSinContactar ?? [],
    kpis: {
      leads: data?.kpis.leads,
      oportunidadesAbiertas: data?.kpis.oportunidadesAbiertas,
      actividadesPendientes: data?.kpis.actividadesPendientes,
      pipelinePonderado: data?.kpis.pipelinePonderado ?? 0,
      pipelinePonderadoPorMoneda: data?.kpis.pipelinePonderadoPorMoneda ?? [],
    },
  };
}
