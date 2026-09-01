import { useQuery } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared";
import { useExchangeRates } from "@/features/catalogos/hooks/useExchangeRates";
import { fetchDireccionKpis } from "@/features/dashboard/direccion/services/kpiDireccion";
import { queryKeys } from "@/lib/query";

export function useDireccionKpis() {
  const { organizationId } = useOrgFilter();
  const { data: tc } = useExchangeRates();
  // P1/P2 moneda: los fallbacks viajan POR MONEDA; una factura EUR sin TC no
  // debe valuarse con el TC del dólar. La queryKey incluye ambos para invalidar.
  const fallbacks = { usd: tc?.usdMxn ?? 0, eur: tc?.eurMxn ?? 0 };
  return useQuery({
    queryKey: queryKeys.direccion.kpis(organizationId, fallbacks.usd, fallbacks.eur),
    queryFn: () => fetchDireccionKpis(organizationId ?? null, fallbacks),
    staleTime: 60_000,
  });
}
