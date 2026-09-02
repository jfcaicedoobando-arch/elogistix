/**
 * Lista de miembros de la organización elegibles como responsables de hallazgos.
 * Filtra a admins y operadores; excluye viewers y clientes.
 *
 * Defecto 10: este hook lo usan roles operativos (no sólo admins), así que no
 * puede depender de `fetchOrgMembers` (resuelve el email vía `user-management`
 * acción `list`, restringida a roles administrativos). Se consulta
 * `organization_members` directamente y los nombres se resuelven con
 * `fetchNombresUsuarios` (`list-nombres`, sin email ni señales de sesión).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr } from "@/lib/supabase/response";
import { fetchNombresUsuarios } from "@/features/admin/services/usuario/availableUsers";
import { UNRESOLVED_EMAIL } from "@/features/admin/services/usuario";
import type { AppRole } from "@/types/appRole";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { queryKeys } from "@/lib/query";

export interface ResponsableOption {
  id: string;
  email: string;
  role: string;
}

interface OrgMemberRoleRow {
  user_id: string;
  role: AppRole;
}

export function useOrgMembersAsignables() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: queryKeys.auditoria.asignables(organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ResponsableOption[]> => {
      if (!organizationId) return [];
      const members = (await unwrapOr(
        supabase
          .from("organization_members")
          .select("user_id, role")
          .eq("organization_id", organizationId),
        [],
      )) as OrgMemberRoleRow[];
      const elegibles = members.filter((m) => m.role === "admin" || m.role === "operador");
      if (elegibles.length === 0) return [];

      const nombres = await fetchNombresUsuarios().catch(() => []);
      const nombreMap = new Map(nombres.map((n) => [n.id, n.full_name]));

      return elegibles
        .map((m) => ({
          id: m.user_id,
          email: nombreMap.get(m.user_id) ?? UNRESOLVED_EMAIL,
          role: m.role,
        }))
        .sort((a, b) => a.email.localeCompare(b.email, "es-MX"));
    },
  });
}
