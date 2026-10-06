/**
 * Servicio Organization — listado de organizaciones activas (usado por super-admin).
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { CAP_LISTA } from "@/constants/queryCaps";
import { z } from "zod";

/** SELECT * keeps the row's other fields; nullable DB values stay nullable. */
const organizationRowSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  rfc: z.string().nullable(),
  logo_url: z.string().nullable(),
  plan: z.string().nullable(),
  activo: z.boolean().nullable(),
}).passthrough();
const organizationRowsSchema = z.array(organizationRowSchema);
export type OrganizationRow = z.infer<typeof organizationRowSchema>;

export async function listActiveOrganizations(): Promise<OrganizationRow[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("activo", true)
    .order("nombre")
    .limit(CAP_LISTA);
  if (error) throw error;
  return fromDb(data ?? [], organizationRowsSchema);
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

/**
 * RG9 (Ola 3): lee el tenant activo que el super admin ya persistió en el
 * servidor (pudo elegirlo desde OTRO dispositivo/navegador). `org_scope()`
 * devuelve justo esa selección, o NULL si no hay ninguna.
 */
export async function getSuperAdminOrg(): Promise<string | null> {
  const { data, error } = await supabase.rpc("org_scope");
  if (error) throw error;
  return (data as string | null) ?? null;
}
