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
