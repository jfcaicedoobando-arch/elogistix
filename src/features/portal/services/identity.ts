import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { unwrap, unwrapOr } from "@/lib/supabase/response";

// Schemas reutilizables para joins anidados — validan el shape en runtime.
const nombreNullableSchema = z.object({ nombre: z.string() }).nullable();
const contactoNullableSchema = z.object({ contacto: z.string().nullable() }).nullable();

const PORTAL_LIST_MAX = 500;

/**
 * Vinculación usuario↔cliente del portal, con el nombre legible del cliente.
 * El join va por RLS: sólo devuelve los clientes que el usuario puede ver.
 */
export interface PortalClientUser {
  cliente_id: string;
  cliente_nombre: string | null;
  organization_id?: string | null;
  user_id?: string | null;
}

export async function fetchPortalClientUsers(): Promise<PortalClientUser[]> {
  const rows = await unwrapOr(
    supabase.from("client_users").select("*, clientes!client_users_cliente_id_fkey(nombre)").limit(PORTAL_LIST_MAX),
    [],
  );
  // SAFE-CAST: el select incluye todas las columnas más el embed `clientes`.
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    ...r,
    cliente_id: typeof r.cliente_id === "string" ? r.cliente_id : "",
    cliente_nombre: fromDb(r.clientes ?? null, nombreNullableSchema)?.nombre ?? null,
  })) as PortalClientUser[];
}

export async function fetchPortalClienteName(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const data = await unwrap(
    supabase
      .from("client_users")
      .select("cliente_id, clientes!client_users_cliente_id_fkey(nombre)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  );
  const clientes = fromDb(data?.clientes ?? null, nombreNullableSchema);
  return clientes?.nombre ?? null;
}

/** UIB-10: nombre de la persona de contacto para el saludo del dashboard. */
export async function fetchPortalContactoNombre(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const data = await unwrap(
    supabase
      .from("client_users")
      .select("cliente_id, clientes!client_users_cliente_id_fkey(contacto)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  );
  const clientes = fromDb(data?.clientes ?? null, contactoNullableSchema);
  return clientes?.contacto ?? null;
}

export async function fetchPortalOrgName(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const data = await unwrap(
    supabase
      .from("client_users")
      .select("organizations(nombre)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  );
  const org = fromDb(data?.organizations ?? null, nombreNullableSchema);
  return org?.nombre ?? null;
}
