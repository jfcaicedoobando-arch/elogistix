import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { fetchDashboardEjecutivo } from "@/services/dashboard-ejecutivo";
import { useCobranza } from "@/hooks/facturacion";
import { useFacturasCxP } from "@/hooks/cxp";

export function useDashboardEjecutivo(periodo: string) {
  const { organizationId } = useOrganization();
  const cobranzaQ = useCobranza({});
  const cxpQ = useFacturasCxP({});
  const ready = !!cobranzaQ.data && !!cxpQ.data && !!periodo;

  return useQuery({
    queryKey: queryKeys.dashboardEjecutivo.snapshot(organizationId, periodo),
    queryFn: () =>
      fetchDashboardEjecutivo({
        organizationId,
        periodo,
        cobranza: cobranzaQ.data!,
        cxp: cxpQ.data!,
      }),
    staleTime: 60_000,
    gcTime: 300_000,
    enabled: ready,
  });
}
