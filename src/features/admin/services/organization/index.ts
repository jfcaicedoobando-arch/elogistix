/**
 * Servicio Organization — listado de organizaciones activas (usado por super-admin).
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";

export interface OrganizationRow {
  id: string;
  nombre: string;
  rfc: string;
  logo_url: string | null;
  plan: string;
  activo: boolean;
}

export async function listActiveOrganizations<T = OrganizationRow>(): Promise<T[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("activo", true)
    .order("nombre")
    .limit(500);
  if (error) throw error;
  return fromDb<T[]>(data ?? []);
}

/**
 * Persiste en el servidor el tenant activo del super admin.
 *
 * Las funciones de agregación (`dashboard_summary`, `direccion_totales`,
 * `operaciones_stats`, etc.) resuelven la organización con `public.org_scope()`,
 * que lee esta selección. Sin este guardado el super admin recibiría los datos
 * de todas las organizaciones mezclados.
 */
export async function setSuperAdminOrg(organizationId: string | null): Promise<void> {
  const { error } = await supabase.rpc("set_super_admin_org", { p_org: organizationId } as never);
  if (error) throw error;
}
