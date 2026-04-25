/**
 * Servicio de administración global: encapsula consultas y mutaciones
 * de organizaciones, miembros y estadísticas usadas por la consola super admin.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/types";

export interface AdminOrgStats {
  totalOrgs: number;
  totalUsers: number;
  totalEmbarques: number;
  totalCotizaciones: number;
}

export interface GlobalUserRow {
  user_id: string;
  email: string;
  org_nombre: string;
  role: string;
}

export interface OrgRow {
  id: string;
  nombre: string;
  rfc: string;
  plan: string;
  activo: boolean;
  created_at: string;
}

export interface UserOption {
  id: string;
  email: string;
}

// ─── Stats ──────────────────────────────────────────────────────────────────
export async function fetchAdminDashboardStats(): Promise<AdminOrgStats> {
  const [orgs, members, embarques, cotizaciones] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("organization_members").select("id", { count: "exact", head: true }),
    supabase.from("embarques").select("id", { count: "exact", head: true }),
    supabase.from("cotizaciones").select("id", { count: "exact", head: true }),
  ]);
  return {
    totalOrgs: orgs.count ?? 0,
    totalUsers: members.count ?? 0,
    totalEmbarques: embarques.count ?? 0,
    totalCotizaciones: cotizaciones.count ?? 0,
  };
}

// ─── Usuarios globales ──────────────────────────────────────────────────────
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

// ─── Organizations ──────────────────────────────────────────────────────────
export async function fetchAdminOrganizations(): Promise<OrgRow[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("nombre");
  if (error) throw error;
  return data as unknown as OrgRow[];
}

export async function fetchOrganizationsList() {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, nombre")
    .order("nombre");
  if (error) throw error;
  return data ?? [];
}

export async function createOrganization(input: { nombre: string; rfc: string }): Promise<void> {
  const { error } = await supabase.from("organizations").insert(input);
  if (error) throw error;
}

// ─── Members ────────────────────────────────────────────────────────────────
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
