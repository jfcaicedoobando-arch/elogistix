/**
 * Conteo de tarifas de agente pendientes de primera aprobación
 * (`estado_aprobacion = 'borrador'`) para la organización activa.
 * Usado por el dashboard de Operaciones (tarjeta "Tarifas por aprobar").
 */
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { contarTarifasPendientesAprobacion } from "@/features/costeo/services/tarifasPendientes";
import { queryKeys } from "@/lib/query";

export function useTarifasPendientesAprobacion() {
  const { organizationId } = useOrganization();
  return useQuery<number>({
    queryKey: queryKeys.costeo.tarifas.pendientesAprobacion(organizationId),
    queryFn: () => contarTarifasPendientesAprobacion(organizationId as string),
    enabled: !!organizationId,
    staleTime: 60_000,
  });
}
