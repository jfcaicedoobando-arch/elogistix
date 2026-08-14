/**
 * Estadísticas globales y por organización para la consola super admin.
 *
 * Ola 16 · separación de planos: las tablas de negocio quedaron acotadas al
 * tenant activo (política RESTRICTIVE + `org_scope()`), así que la telemetría
 * de PLATAFORMA ya no puede leerlas directo. Se usa RPC `SECURITY DEFINER`
 * fail-closed para super admin: `fn_admin_platform_stats` y `fn_admin_org_counts`.
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
  // Optimización: RPC `fn_admin_org_activity` agrega conteos en SQL en una
  // sola consulta. Antes descargaba toda la tabla embarques+cotizaciones
  // (escaneo completo + conteo en JS) — fallaba por timeout al crecer la DB.
  const { data, error } = await supabase.rpc("fn_admin_org_activity");
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; nombre: string; embarques: number; cotizaciones: number }>).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    embarques: Number(r.embarques) || 0,
    cotizaciones: Number(r.cotizaciones) || 0,
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

interface PlatformStatsRow {
  total_orgs: number | string | null;
  total_users: number | string | null;
  total_embarques: number | string | null;
  total_cotizaciones: number | string | null;
}

const num = (v: number | string | null | undefined): number => Number(v ?? 0) || 0;

export async function fetchAdminDashboardStats(): Promise<AdminOrgStats> {
  const { data, error } = await supabase.rpc("fn_admin_platform_stats");
  if (error) throw error;
  const row = ((data ?? []) as PlatformStatsRow[])[0];
  return {
    totalOrgs: num(row?.total_orgs),
    totalUsers: num(row?.total_users),
    totalEmbarques: num(row?.total_embarques),
    totalCotizaciones: num(row?.total_cotizaciones),
  };
}

interface OrgCountsRow {
  miembros: number | string | null;
  embarques: number | string | null;
  clientes: number | string | null;
  cotizaciones: number | string | null;
}

async function fetchOrgCounts(orgId: string): Promise<OrgCountsRow | undefined> {
  const { data, error } = await supabase.rpc("fn_admin_org_counts", { _org: orgId });
  if (error) throw error;
  return ((data ?? []) as OrgCountsRow[])[0];
}

export const countOrgMembers = async (orgId: string) => num((await fetchOrgCounts(orgId))?.miembros);
export const countOrgEmbarques = async (orgId: string) => num((await fetchOrgCounts(orgId))?.embarques);
export const countOrgClientes = async (orgId: string) => num((await fetchOrgCounts(orgId))?.clientes);
export const countOrgCotizaciones = async (orgId: string) => num((await fetchOrgCounts(orgId))?.cotizaciones);
