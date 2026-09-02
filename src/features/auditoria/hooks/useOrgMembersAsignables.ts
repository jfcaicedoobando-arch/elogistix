/**
 * Lista de miembros de la organización elegibles como responsables de hallazgos.
 * Sólo orquesta cache: la consulta vive en el servicio `miembrosAsignables`.
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchMiembrosAsignables,
  type ResponsableOption,
} from "@/features/auditoria/services/miembrosAsignables";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { queryKeys } from "@/lib/query";

export type { ResponsableOption };

export function useOrgMembersAsignables() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: queryKeys.auditoria.asignables(organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60_000,
    queryFn: () => fetchMiembrosAsignables(organizationId),
  });
}
