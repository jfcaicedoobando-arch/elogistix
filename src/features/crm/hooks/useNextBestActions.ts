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
import { queryKeys } from "@/lib/query";

function useNbaSignals() {
  const { user } = useAuth();
  return useQuery<NbaSignals>({
    queryKey: queryKeys.crm.nbaSignals(user?.id),
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: () => fetchNbaSignals(user?.id, user?.email),
  });
}

export function useNextBestActions(limit = 5): {
  items: NbaItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const { data: signals, isLoading: l1, isError: e1, refetch: r1 } = useNbaSignals();
  const { data: cots = [], isLoading: l2, isError: e2, refetch: r2 } = useCotizacionesSinRespuesta(5, 10);
  const { data: vencidas = [], isLoading: l3, isError: e3, refetch: r3 } = useActividadesVencidasList(10);

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

  return {
    items,
    isLoading: l1 || l2 || l3,
    isError: e1 || e2 || e3,
    refetch: () => { void r1(); void r2(); void r3(); },
  };
}
