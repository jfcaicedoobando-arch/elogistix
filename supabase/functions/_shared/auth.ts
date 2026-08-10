import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { Logger } from "./logger.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

export interface AuthContext {
  userId: string;
  authHeader: string;
  anonClient: SupabaseClient;
  adminClient: SupabaseClient;
}

/**
 * Valida el JWT del request y retorna clientes pre-configurados.
 * Si se pasa `log`, asigna el `user_id` verificado al logger (12.32.0).
 * Lanza Error con mensaje "401:..." o "500:..." para manejo en el caller.
 */
export async function authenticate(req: Request, log?: Logger): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("401:No autorizado");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await anonClient.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new Error("401:Token inválido");
  }

  const userId = data.claims.sub;
  log?.setUserId(userId);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  return { userId, authHeader, anonClient, adminClient };
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
    .in("role", ["admin", "admin_org"])
    .maybeSingle();

  if (!orgData) {
    return { isGlobalAdmin: false, orgId: null };
  }
  return { isGlobalAdmin: false, orgId: orgData.organization_id };
}

/**
 * Verifica que `userId` pertenezca a la organización `organizationId`.
 * Retorna true si es super_admin/admin global (acceso cross-org) o si es
 * miembro directo. Usar con `adminClient` (service_role) para evitar RLS.
 */
export async function authorizeOrgMembership(
  adminClient: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  // Ola 9 · A13: sólo `super_admin` es rol de PLATAFORMA con acceso cross-org.
  // El `admin` global es un rol legacy de organización y ya NO abre otras orgs;
  // debe validarse por membresía, igual que `authorizeOrgRole`.
  const { data: superRole } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (superRole) return true;

  const { data: member } = await adminClient
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return !!member;
}

/**
 * FIX C2 (S5-02) — Listas de rol del Bloque Q, espejo server-side de
 * `src/hooks/shared/usePermissions.ts` (EMITIR_FACTURA_CLIENTE,
 * REGISTRAR_COBRO) y del helper SQL `es_escritor_financiero`
 * (migración 20260722001738). Mantener sincronizadas con ambos.
 */
export const ROLES_EMISOR_FISCAL: readonly string[] = [
  "super_admin", "admin_org", "admin", "contador",
];
export const ROLES_COBRANZA_FISCAL: readonly string[] = [
  "super_admin", "admin_org", "admin", "contador", "ejecutivo_cobranza",
];
export const ROLES_CONSULTA_FISCAL: readonly string[] = [
  "super_admin", "admin_org", "admin", "contador",
  "tesorero", "auxiliar_contable", "ejecutivo_cobranza",
];

/**
 * FIX C2 (S5-02) + A13 (Ola 4) — Membresía + rol efectivo. Semántica:
 *   1) `super_admin` global (`user_roles`) → acceso cross-org (rol de plataforma).
 *   2) Miembro de la org cuyo `organization_members.role` (rol efectivo)
 *      está en `rolesPermitidos`.
 *   3) Miembro SIN rol de organización: se respalda en el rol global
 *      (incluye `admin` global).
 * Si la membresía tiene rol, éste manda: una democión a nivel organización
 * revoca el acceso aunque el rol global heredado (incluido `admin`) siga
 * siendo permisivo. `super_admin` en `organization_members` se ignora: es un
 * rol de plataforma y no puede otorgarse desde una organización.
 */
export async function authorizeOrgRole(
  adminClient: SupabaseClient,
  userId: string,
  organizationId: string,
  rolesPermitidos: readonly string[],
): Promise<boolean> {
  const { data: superRole } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (superRole) return true;

  const { data: member } = await adminClient
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!member) return false;
  // M1 — `super_admin` es rol de plataforma: si aparece en `organization_members`
  // (dato legacy o mal asignado) se ignora y se cae al rol global.
  const rolOrg = member.role === "super_admin" ? null : member.role;
  // El rol de la organización es la fuente de verdad cuando existe.
  if (rolOrg) return rolesPermitidos.includes(rolOrg);

  const { data: globalRole } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", ...rolesPermitidos] as string[])
    .maybeSingle();
  return !!globalRole;
}

/**
 * v13.458.0 — Autoriza a un usuario del portal de clientes sobre un CFDI.
 * Los clientes no son miembros de la organización (no tienen fila en
 * `organization_members`), su vínculo vive en `client_users`. Se exige que el
 * usuario esté ligado al mismo `cliente_id` del documento y a su organización.
 */
export async function authorizePortalCliente(
  adminClient: SupabaseClient,
  userId: string,
  clienteId: string | null,
  organizationId: string,
): Promise<boolean> {
  if (!clienteId) return false;
  const { data } = await adminClient
    .from("client_users")
    .select("id")
    .eq("user_id", userId)
    .eq("cliente_id", clienteId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return !!data;
}
