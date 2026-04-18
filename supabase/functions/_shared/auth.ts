// @ts-expect-error Deno remote import
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthContext {
  userId: string;
  authHeader: string;
  anonClient: SupabaseClient;
  adminClient: SupabaseClient;
}

/**
 * Valida el JWT del request y retorna clientes pre-configurados.
 * Lanza Error con mensaje "401:..." o "500:..." para manejo en el caller.
 */
export async function authenticate(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("401:No autorizado");
  }

  // @ts-expect-error Deno global
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  // @ts-expect-error Deno global
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  // @ts-expect-error Deno global
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await anonClient.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new Error("401:Token inválido");
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  return { userId: data.claims.sub, authHeader, anonClient, adminClient };
}

/**
 * Verifica si el usuario es admin global (admin/super_admin) o admin de organización.
 * Retorna { isGlobalAdmin, orgId } — orgId es la organización del usuario si aplica.
 */
export async function checkAdminAccess(
  adminClient: SupabaseClient,
  userId: string,
): Promise<{ isGlobalAdmin: boolean; orgId: string | null }> {
  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"])
    .maybeSingle();

  const isGlobalAdmin = !!roleData;

  if (isGlobalAdmin) {
    const { data: orgMember } = await adminClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    return { isGlobalAdmin: true, orgId: orgMember?.organization_id ?? null };
  }

  const { data: orgData } = await adminClient
    .from("organization_members")
    .select("role, organization_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!orgData) {
    return { isGlobalAdmin: false, orgId: null };
  }
  return { isGlobalAdmin: false, orgId: orgData.organization_id };
}
