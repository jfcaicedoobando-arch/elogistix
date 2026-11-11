import { useQuery } from "@tanstack/react-query";
import { fetchCxpPorPagarCount } from "@/features/bandejas/services/bandejas";
import { bandejas } from "@/features/bandejas/queryKeys";
import { useOrgFilter } from "@/hooks/shared";
import { staleTimes } from "@/lib/query/staleTimes";

export function useCxpPorPagarCount({ enabled = true }: { enabled?: boolean } = {}) {
  const { organizationId, orgListo } = useOrgFilter();
  return useQuery({
    queryKey: bandejas.cxpPorPagarCount(organizationId),
    queryFn: fetchCxpPorPagarCount,
    // Las mutaciones de CxP invalidan el prefijo ["bandeja"].
    staleTime: staleTimes.LONG,
    enabled: enabled && orgListo && !!organizationId,
  });
}
