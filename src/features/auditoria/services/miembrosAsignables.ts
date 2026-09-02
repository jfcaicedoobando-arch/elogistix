/**
 * Miembros de la organización elegibles como responsables de hallazgos.
 *
 * Defecto 10: lo consumen roles operativos (no sólo admins), así que no puede
 * depender de `fetchOrgMembers` (acción `list` de `user-management`, restringida
 * a roles administrativos). Se consulta `organization_members` directamente y
 * los nombres se resuelven con `fetchNombresUsuarios` (`list-nombres`, sin email
 * ni señales de sesión).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr } from "@/lib/supabase/response";
import { fetchNombresUsuarios } from "@/features/admin/services/usuario/availableUsers";
import { UNRESOLVED_EMAIL } from "@/features/admin/services/usuario";
import type { AppRole } from "@/types/appRole";

export interface ResponsableOption {
  id: string;
  email: string;
  role: string;
}

interface OrgMemberRoleRow {
  user_id: string;
  role: AppRole;
}

export async function fetchMiembrosAsignables(
  organizationId: string | null | undefined,
): Promise<ResponsableOption[]> {
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
}
