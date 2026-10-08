import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { crm } from "../queryKeys";
import { obtenerResumenPricing } from "../services/pricing/resumenPricing";

export function useResumenPricing() {
  const { user, loading: authLoading } = useAuth();
  const { organizationId, loading: organizationLoading } = useOrganization();
  const loading = authLoading || organizationLoading;
  const query = useQuery({
    queryKey: crm.resumenPricing(organizationId, user?.id),
    queryFn: () => obtenerResumenPricing(organizationId),
    enabled: Boolean(organizationId && user?.id && !loading),
    staleTime: 60_000,
  });
  return { ...query, data: loading ? undefined : query.data, isError: !loading && query.isError, isLoading: loading || query.isLoading };
}
