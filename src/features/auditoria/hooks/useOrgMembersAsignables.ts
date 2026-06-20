/**
 * Lista de miembros de la organización elegibles como responsables de hallazgos.
 * Filtra a admins y operadores; excluye viewers y clientes.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchOrgMembers, type OrgMemberRow } from "@/features/admin/services/members";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { queryKeys } from "@/lib/query";

export interface ResponsableOption {
  id: string;
  email: string;
  role: string;
}

export function useOrgMembersAsignables() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: queryKeys.auditoria.asignables(organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ResponsableOption[]> => {
      if (!organizationId) return [];
      const members: OrgMemberRow[] = await fetchOrgMembers(organizationId);
      return members
        .filter((m) => m.role === "admin" || m.role === "operador")
        .map((m) => ({ id: m.user_id, email: m.email ?? m.user_id, role: m.role }))
        .sort((a, b) => a.email.localeCompare(b.email, "es-MX"));
    },
  });
}
