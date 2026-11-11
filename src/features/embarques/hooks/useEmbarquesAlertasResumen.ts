/**
 * v13.142.3 — Hook con el desglose de las alertas que alimentan el badge
 * "Embarques · N" del sidebar (demoras, garantías atoradas, cierre admin
 * pendiente). Los IDs se filtran en PostgreSQL y el panel recibe totales.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchEmbarquesAlertasResumen } from "@/features/embarques/services/alertas";
import { useOrgFilter } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";

export function useEmbarquesAlertasResumen() {
  const { organizationId, orgListo } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.embarques.alertasResumen(organizationId),
    queryFn: fetchEmbarquesAlertasResumen,
    enabled: orgListo,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

}
