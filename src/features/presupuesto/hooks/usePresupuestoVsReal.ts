import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchPresupuestoVsReal } from "@/features/presupuesto/services";
import { useOrgFilter } from "@/hooks/shared";

export function usePresupuestoVsReal(periodo: string) {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.presupuesto.vsRealPorOrg(periodo, organizationId ?? null),
    queryFn: () => fetchPresupuestoVsReal(periodo, organizationId ?? null),
    staleTime: 30_000,
    enabled: !!periodo && !!organizationId,
  });
}
