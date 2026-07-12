import { useQuery } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared";
import { useExchangeRates } from "@/features/catalogos/hooks/useExchangeRates";
import { fetchDireccionKpis } from "@/features/dashboard/direccion/services/kpiDireccion";
import { queryKeys } from "@/lib/query";

export function useDireccionKpis() {
  const { organizationId } = useOrgFilter();
  const { data: tc } = useExchangeRates();
  const fallback = tc?.usdMxn ?? 0;
  return useQuery({
    queryKey: queryKeys.direccion.kpis(organizationId, fallback),
    queryFn: () => fetchDireccionKpis(organizationId ?? null, fallback),
    staleTime: 60_000,
  });
}
