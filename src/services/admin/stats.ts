/**
 * Estadísticas globales y por organización para la consola super admin.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AdminOrgStats {
  totalOrgs: number;
  totalUsers: number;
  totalEmbarques: number;
  totalCotizaciones: number;
}

export interface AdminOrgActivity {
  id: string;
  nombre: string;
  embarques: number;
  cotizaciones: number;
}

export interface AdminRecentOrg {
  id: string;
  nombre: string;
  plan: string;
  created_at: string;
}

export async function fetchAdminOrgActivity(): Promise<AdminOrgActivity[]> {
  const [orgsRes, embRes, cotRes] = await Promise.all([
    supabase.from("organizations").select("id, nombre").order("nombre"),
    supabase.from("embarques").select("organization_id"),
    supabase.from("cotizaciones").select("organization_id"),
  ]);
  const orgs = orgsRes.data ?? [];
  const embCounts: Record<string, number> = {};
  (embRes.data ?? []).forEach((r) => {
    if (r.organization_id) embCounts[r.organization_id] = (embCounts[r.organization_id] ?? 0) + 1;
  });
  const cotCounts: Record<string, number> = {};
  (cotRes.data ?? []).forEach((r) => {
    if (r.organization_id) cotCounts[r.organization_id] = (cotCounts[r.organization_id] ?? 0) + 1;
  });
  return orgs.map((o) => ({
    id: o.id,
    nombre: o.nombre,
    embarques: embCounts[o.id] ?? 0,
    cotizaciones: cotCounts[o.id] ?? 0,
  }));
}

export async function fetchAdminRecentOrgs(limit = 5): Promise<AdminRecentOrg[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, nombre, plan, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AdminRecentOrg[];
}

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

async function countByOrg(
  table: "organization_members" | "embarques" | "clientes" | "cotizaciones",
  orgId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if (error) throw error;
  return count ?? 0;
}

export const countOrgMembers = (orgId: string) => countByOrg("organization_members", orgId);
export const countOrgEmbarques = (orgId: string) => countByOrg("embarques", orgId);
export const countOrgClientes = (orgId: string) => countByOrg("clientes", orgId);
export const countOrgCotizaciones = (orgId: string) => countByOrg("cotizaciones", orgId);
