import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { unwrap, unwrapOr } from "@/lib/supabase/response";

// Schemas reutilizables para joins anidados — validan el shape en runtime.
const nombreNullableSchema = z.object({ nombre: z.string() }).nullable();
const contactoNullableSchema = z.object({ contacto: z.string().nullable() }).nullable();

const PORTAL_LIST_MAX = 500;

export async function fetchPortalClientUsers() {
  return unwrapOr(supabase.from("client_users").select("*").limit(PORTAL_LIST_MAX), []);
}

export async function fetchPortalClienteName(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const data = await unwrap(
    supabase
      .from("client_users")
      .select("cliente_id, clientes(nombre)")
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
      .select("cliente_id, clientes(contacto)")
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
