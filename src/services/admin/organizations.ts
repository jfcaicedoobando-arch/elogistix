/**
 * CRUD y consultas de organizaciones para la consola super admin.
 */
import { supabase } from "@/integrations/supabase/client";

export interface OrgRow {
  id: string;
  nombre: string;
  rfc: string;
  plan: string;
  activo: boolean;
  created_at: string;
}

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

export async function fetchAdminOrganization(id: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateAdminOrganization(
  id: string,
  payload: { nombre: string; rfc: string; plan: string },
): Promise<void> {
  const { error } = await supabase
    .from("organizations")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

export async function setOrganizationActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase
    .from("organizations")
    .update({ activo })
    .eq("id", id);
  if (error) throw error;
}
