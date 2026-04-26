/**
 * Miembros de organización y usuarios globales para la consola super admin.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/types";

export interface GlobalUserRow {
  user_id: string;
  email: string;
  org_nombre: string;
  role: string;
}

export interface UserOption {
  id: string;
  email: string;
}

export interface OrgMemberRow {
  id: string;
  user_id: string;
  role: AppRole;
  email?: string;
}

export async function fetchAvailableUsers(): Promise<UserOption[]> {
  const { data } = await supabase.functions.invoke("list-users");
  return Array.isArray(data) ? (data as UserOption[]) : [];
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

export async function addOrgMember(params: {
  organizationId: string;
  userId: string;
  role: AppRole;
}): Promise<void> {
  const { error } = await supabase.from("organization_members").insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    role: params.role,
  });
  if (error) throw error;
}
