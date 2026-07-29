/**
 * Rutas disponibles de la organización vinculada al agente, para el formulario
 * de tarifas en el portal del agente.
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchAgenteRutas } from "@/features/portal-agente/services";

export function useAgenteTarifaRutas(organizationId: string | undefined, open: boolean) {
  return useQuery({
    queryKey: queryKeys.portalAgente.rutas(organizationId),
    queryFn: () => fetchAgenteRutas(),
    enabled: !!organizationId && open,
    staleTime: 5 * 60 * 1000,
  });
}
