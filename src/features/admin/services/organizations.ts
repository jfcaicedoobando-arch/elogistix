/**
 * CRUD y consultas de organizaciones para la consola super admin.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";

export interface OrgRow {
  id: string;
  nombre: string;
  rfc: string;
  plan: string;
  activo: boolean;
  created_at: string;
}

export async function fetchAdminOrganizations(): Promise<OrgRow[]> {
  const data = await unwrap(
    supabase.from("organizations").select("*").order("nombre"),
  );
  return fromDb<OrgRow[]>(data);
}

export async function fetchOrganizationsList() {
  return unwrapOr(
    supabase.from("organizations").select("id, nombre").order("nombre"),
    [],
  );
}

export async function createOrganization(input: { nombre: string; rfc: string }): Promise<void> {
  await run(supabase.from("organizations").insert(input));
}

export async function fetchAdminOrganization(id: string) {
  return unwrap(
    supabase.from("organizations").select("*").eq("id", id).single(),
  );
}

export async function updateAdminOrganization(
  id: string,
  payload: { nombre: string; rfc: string; plan: string },
): Promise<void> {
  await run(supabase.from("organizations").update(payload).eq("id", id));
}

export async function establecerOrganizacionActiva(id: string, activo: boolean): Promise<void> {
  await run(supabase.from("organizations").update({ activo }).eq("id", id));
}
