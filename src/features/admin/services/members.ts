/**
 * Miembros de organización y usuarios globales para la consola super admin.
 *
 * `fetchAvailableUsers`/`UserOption` viven ahora en `@/features/admin/services/usuario/availableUsers`
 * (v13.56.2 — auditoría paso 6). Aquí se re-exportan para mantener compatibilidad
 * con consumidores existentes (`useOrgMembersMutations`, tests).
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/appRole";
import { fetchAvailableUsers, type UserOption } from "@/features/admin/services/usuario/availableUsers";

export { fetchAvailableUsers };
export type { UserOption };

export interface GlobalUserRow {
  user_id: string;
  email: string;
  org_nombre: string;
  role: string;
}

export interface OrgMemberRow {
  id: string;
  user_id: string;
  role: AppRole;
  email?: string;
}

export async function fetchAdminGlobalUsers(): Promise<GlobalUserRow[]> {
  const { data: members, error } = await supabase
    .from("organization_members")
    .select("user_id, role, organization_id")
    .order("user_id");
  if (error) throw error;

  const { data: orgs } = await supabase.from("organizations").select("id, nombre");
  const orgMap: Record<string, string> = {};
  (orgs ?? []).forEach((o) => {
    orgMap[o.id] = o.nombre;
  });

  const emailMap: Record<string, string> = {};
  try {
    const users = await fetchAvailableUsers();
    users.forEach((u) => {
      emailMap[u.id] = u.email;
    });
  } catch {
    /* edge function may not be available */
  }

  return (members ?? []).map((m) => ({
    user_id: m.user_id,
    email: emailMap[m.user_id] || m.user_id,
    org_nombre: orgMap[m.organization_id] || m.organization_id,
    role: m.role,
  }));
}

export async function fetchOrgMembers(orgId: string): Promise<OrgMemberRow[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, user_id, role")
    .eq("organization_id", orgId)
    .order("created_at");
  if (error) throw error;

  const emailMap: Record<string, string> = {};
  try {
    const users = await fetchAvailableUsers();
    users.forEach((u) => { emailMap[u.id] = u.email; });
  } catch { /* edge function may be unavailable */ }

  return (data ?? []).map((m) => ({
    ...m,
    email: emailMap[m.user_id] || m.user_id,
  })) as OrgMemberRow[];
}

export async function updateOrgMemberRole(memberId: string, role: AppRole): Promise<void> {
  const { error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("id", memberId);
  if (error) throw error;
}

export async function removeOrgMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId);
  if (error) throw error;
}

// Nota: el alta de miembros se hace creando un usuario nuevo vía edge function
// `user-management` (action `create`). No exponemos un servicio para asociar
// usuarios existentes — un usuario sólo puede pertenecer a una organización.
