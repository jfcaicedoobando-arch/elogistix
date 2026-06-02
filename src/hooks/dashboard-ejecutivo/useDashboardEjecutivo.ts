import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { fetchDashboardEjecutivo } from "@/services/dashboard-ejecutivo/agregador";

export function useDashboardEjecutivo(periodo: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: queryKeys.dashboardEjecutivo.snapshot(organizationId, periodo),
    queryFn: () => fetchDashboardEjecutivo({ organizationId, periodo }),
    staleTime: 60_000,
    gcTime: 300_000,
    enabled: !!periodo,
  });
}
