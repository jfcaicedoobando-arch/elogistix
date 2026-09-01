import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
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
  // RTC-02: la verificación remota (`getUser`) es la fuente de verdad. Cuando el
  // proyecto firma con el secreto legacy (HS256), `getClaims` no puede validar la
  // firma en local y devolvía "Token inválido" con tokens perfectamente válidos.
  // `getClaims` queda sólo como respaldo si la llamada remota falla.
  const authApi = anonClient.auth as unknown as {
    getClaims?: (t: string) => Promise<{
      data: { claims?: { sub?: string } } | null;
      error: unknown;
    }>;
  };

  let userId: string | undefined;
  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (!userErr && userData?.user?.id) {
    userId = userData.user.id;
  } else if (typeof authApi.getClaims === "function") {
    const { data, error } = await authApi.getClaims(token);
    if (error || !data?.claims?.sub) throw new Error("401:Token inválido");
    userId = data.claims.sub;
  } else {
    throw new Error("401:Token inválido");
  }


  log?.setUserId(userId);


  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  return { userId, authHeader, anonClient, adminClient };
}

/**
 * Verifica si el usuario es admin de PLATAFORMA (`super_admin`) o admin de
 * organización. Retorna { isGlobalAdmin, orgId }.
 *
 * R2 seguridad · P1 (alineado con Ola 9 · A13): el rol global legacy `admin`
 * ya NO otorga acceso cross-org — antes se equiparaba a `super_admin` y
 * `isGlobalAdmin` habilita alta/baja de usuarios y recordatorios en CUALQUIER
 * organización. Un `admin` legacy conserva permisos de administrador
 * únicamente donde tenga membresía admin/admin_org (segunda rama de abajo),
 * igual que ya hacen `authorizeOrgMembership` y `authorizeOrgRole`.
 */
export async function checkAdminAccess(
  adminClient: SupabaseClient,
  userId: string,
): Promise<{ isGlobalAdmin: boolean; orgId: string | null }> {
  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
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
 * Descarga de PDF/XML de un CFDI ya timbrado: es LECTURA del expediente y debe
 * cubrir a todos los roles con acceso a `/facturacion` en la UI
 * (`FACTURACION_ROLES` en `src/lib/access/roleRouteMatrix.ts`). Sin esta lista
 * los roles operativos veían el botón de descarga y recibían 403 "forbidden".
 * Mantener sincronizada con `FACTURACION_ROLES`.
 */
export const ROLES_DESCARGA_CFDI: readonly string[] = [
  ...ROLES_CONSULTA_FISCAL,
  "operador", "coordinador_logistico", "gerente_operaciones", "gerente_visor",
];

/**
 * R2 seguridad · P1 — Captura CxP (buzón / parseo con IA de facturas de
 * proveedor). Espejo server-side de `COMPRAS_POR_CAPTURAR_ROLES`
 * (`src/lib/access/roleRouteSets.ts`). Mantener sincronizada. Excluye
 * `operador` y los roles de portal (`cliente`, `agente_carga`) y con ello a la
 * cuenta demo pública.
 */
export const ROLES_CAPTURA_CXP: readonly string[] = [
  "super_admin", "admin", "admin_org", "contador", "tesorero",
  "auxiliar_contable", "gerente_operaciones", "gerente_visor",
];

/**
 * Adjuntar/verificar el XML de un documento del buzón del embarque. Operaciones
 * entrega los PDF/XML del agente y contabilidad los captura después, así que la
 * lista es la UNIÓN de ambas. Espejo server-side de
 * `ADJUNTAR_XML_FACTURA_ENTRANTE` (`src/lib/access/permissionMatrix.operaciones.ts`)
 * y de la RPC `adjuntar_xml_factura_entrante`. Mantener sincronizada: sin
 * `operador` / `coordinador_logistico` la subida desde el embarque fallaba con
 * 403 después de guardar el archivo.
 */
export const ROLES_ADJUNTAR_XML_ENTRANTE: readonly string[] = [
  "super_admin", "admin", "admin_org", "operador", "coordinador_logistico",
  "gerente_operaciones", "contador", "auxiliar_contable",
];


/**
 * R2 · W-05 — Escritura/envío de cotizaciones. Espejo server-side del helper
 * SQL `public.puede_escribir_cotizaciones` (v13.750.0). Mantener sincronizada:
 * si un rol puede editar la cotización en BD, debe poder enviarla por correo.
 * Excluye roles de portal (`cliente`, `agente_carga`) y de sólo lectura.
 */
export const ROLES_ESCRITURA_COTIZACIONES: readonly string[] = [
  "super_admin", "admin", "admin_org", "gerente_comercial", "vendedor",
  "ejecutivo_pricing", "coordinador_logistico", "gerente_operaciones",
  "operador", "customer_service",
];

/**
 * R2 · N-01 — Alta de datos fiscales (parseo de CSF con IA en clientes y
 * proveedores). Une los roles comerciales que dan de alta clientes con los
 * roles contables que dan de alta proveedores.
 */
export const ROLES_ALTA_FISCAL: readonly string[] = [
  "super_admin", "admin", "admin_org", "gerente_comercial", "vendedor",
  "coordinador_logistico", "gerente_operaciones", "contador",
  "auxiliar_contable", "tesorero",
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
