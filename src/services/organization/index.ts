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
  const { data } = await supabase
    .from("organizations")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  return fromDb<T[]>(data ?? []);
}
