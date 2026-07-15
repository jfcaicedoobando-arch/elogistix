import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { fetchDashboardEjecutivo } from "@/features/dashboardEjecutivo/services";
import { useCobranza } from "@/features/facturacion/hooks";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useFuenteEerr } from "@/features/profit/hooks/useFuenteEerr";

export function useDashboardEjecutivo(periodo: string) {
  const { organizationId } = useOrganization();
  const { fuente } = useFuenteEerr();
  const cobranzaQ = useCobranza({});
  const cxpQ = useFacturasCxP({});
  const ready = !!cobranzaQ.data && !!cxpQ.data && !!periodo;

  return useQuery({
    queryKey: queryKeys.dashboardEjecutivo.snapshot(organizationId, periodo, fuente),
    queryFn: () =>
      fetchDashboardEjecutivo({
        organizationId,
        periodo,
        fuente,
        cobranza: cobranzaQ.data!,
        cxp: cxpQ.data!,
      }),
    staleTime: 60_000,
    gcTime: 300_000,
    enabled: ready,
  });
}
