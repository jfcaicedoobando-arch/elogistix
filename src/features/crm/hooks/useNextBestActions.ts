/**
 * Combina señales del CRM (leads sin contactar, oportunidades abiertas,
 * cotizaciones sin respuesta, actividades vencidas) y devuelve las top N
 * acciones priorizadas para el vendedor — vía `computeNextBestActions`.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useActividadesVencidasList } from "./useCrmDashboard";
import { useCotizacionesSinRespuesta } from "./useCotizacionesSinRespuesta";
import { computeNextBestActions, type NbaItem } from "@/features/crm/domain/nextBestActions";
import { fetchNbaSignals, type NbaSignals } from "@/features/crm/services/nbaSignals";

function useNbaSignals() {
  const { user } = useAuth();
  return useQuery<NbaSignals>({
    queryKey: ["crm", "nba-signals", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: () => fetchNbaSignals(),
  });
}

export function useNextBestActions(limit = 5): { items: NbaItem[]; isLoading: boolean } {
  const { data: signals, isLoading: l1 } = useNbaSignals();
  const { data: cots = [], isLoading: l2 } = useCotizacionesSinRespuesta(5, 10);
  const { data: vencidas = [], isLoading: l3 } = useActividadesVencidasList(10);

  const items = useMemo(() => {
    if (!signals) return [];
    return computeNextBestActions(
      {
        leadsSinContactar: signals.leadsSinContactar,
        oportunidadesAbiertas: signals.oportunidadesAbiertas,
        cotizacionesSinRespuesta: cots,
        actividadesVencidas: vencidas,
      },
      limit,
    );
  }, [signals, cots, vencidas, limit]);

  return { items, isLoading: l1 || l2 || l3 };
}
