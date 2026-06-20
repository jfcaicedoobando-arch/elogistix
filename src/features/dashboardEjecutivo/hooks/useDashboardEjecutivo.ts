import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { fetchDashboardEjecutivo } from "@/features/dashboardEjecutivo/services";
import { useCobranza } from "@/features/facturacion/hooks";
import { useFacturasCxP } from "@/features/cxp/hooks";

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
