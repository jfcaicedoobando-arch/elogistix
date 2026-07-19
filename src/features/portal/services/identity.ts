import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { unwrap, unwrapOr } from "@/lib/supabase/response";

// Schema reutilizable para joins anidados { nombre } | null — valida en runtime.
const nombreNullableSchema = z.object({ nombre: z.string() }).nullable();

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
  nombreNullableSchema.parse(data?.clientes ?? null); // valida shape en runtime
  const clientes = fromDb<{ nombre: string } | null>(data?.clientes);
  return clientes?.nombre ?? null;
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
  nombreNullableSchema.parse(data?.organizations ?? null); // valida shape en runtime
  const org = fromDb<{ nombre: string } | null>(data?.organizations);
  return org?.nombre ?? null;
}
