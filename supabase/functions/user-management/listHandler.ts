/**
 * Handler `list`: listado de usuarios con scope por organización.
 * Extraído de `handlers.ts` para respetar Power-of-10.
 *
 * v-defecto10: `action=list` (con email/last_sign_in/email_confirmed) queda
 * restringido a roles administrativos (admin, admin_org, super_admin). Los
 * roles operativos que sólo necesitan resolver nombres usan `list-nombres`
 * (ver `listNombresHandler.ts`), que no expone email ni señales de sesión.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import type { HandlerCtx, AdminAccess } from "./types.ts";

const ALLOWED_ROLES = new Set(["admin", "admin_org", "super_admin"]);

/** Fila de auth expuesta al cliente (Q-05b incluye señales de invitación). */
export interface AuthUserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  /** VB-15: permite a la UI mostrar el nombre aunque el correo falle. */
  full_name: string | null;
}

export async function resolveOrgScope(
  adminClient: SupabaseClient,
  userId: string,
  isGlobalAdmin: boolean,
  adminOrgId: string | null,
): Promise<string | null> {
  if (isGlobalAdmin || adminOrgId) return adminOrgId;
  const { data: membership } = await adminClient
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const orgId = (membership as { organization_id?: string } | null)?.organization_id ?? null;
  if (!orgId) throw new Error("403:Sin organización");
  return orgId;
}

/** Verifica si el usuario tiene alguno de los roles del conjunto dado. */
export async function tieneAlgunRol(
  adminClient: SupabaseClient,
  callerId: string,
  allowedRoles: Set<string>,
): Promise<boolean> {
  const { data: rolesData } = await adminClient.from("user_roles").select("role").eq("user_id", callerId);
  const { data: orgRoles } = await adminClient.from("organization_members").select("role").eq("user_id", callerId);
  const roles = [
    ...((rolesData ?? []) as Array<{ role: string }>).map((r) => r.role),
    ...((orgRoles ?? []) as Array<{ role: string }>).map((r) => r.role),
  ];
  return roles.some((r) => allowedRoles.has(r));
}

/**
 * Sentry JAVASCRIPT-REACT-3M: `listUsers()` pagina de 50 en 50 por defecto,
 * así que los usuarios fuera de la primera página quedaban sin correo
 * ("sin resolver") en la tabla de /usuarios. Recorremos todas las páginas.
 */
export async function listarTodosLosUsuarios(
  adminClient: SupabaseClient,
): Promise<AuthUserRow[]> {
  const baseRows: AuthUserRow[] = [];
  const PER_PAGE = 1000;
  const MAX_PAGES = 20;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw error;
    const pageUsers = (data?.users ?? []) as Array<{
      id: string;
      email?: string;
      created_at: string;
      last_sign_in_at?: string | null;
      email_confirmed_at?: string | null;
      confirmed_at?: string | null;
      user_metadata?: { full_name?: string | null } | null;
    }>;
    for (const u of pageUsers) {
      baseRows.push({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        full_name: u.user_metadata?.full_name ?? null,
        // Q-05b: permiten distinguir "Invitación pendiente" de "Activo".
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? u.confirmed_at ?? null,
      });
    }
    if (pageUsers.length < PER_PAGE) break;
  }
  return baseRows;
}

/** Filtra el listado global a sólo los miembros de la organización dada. */
export async function filtrarPorOrganizacion(
  adminClient: SupabaseClient,
  orgId: string,
  baseRows: AuthUserRow[],
): Promise<AuthUserRow[]> {
  const { data: members } = await adminClient
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId);
  const allowedIds = new Set(((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id));
  return baseRows.filter((u) => allowedIds.has(u.id));
}

export async function handleList(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { cors, log, callerId, adminClient } = ctx;

  const allowed = await tieneAlgunRol(adminClient, callerId, ALLOWED_ROLES);
  if (!allowed) {
    log.finish(403, "role_not_allowed", { user_id: callerId });
    return errorResponse("Solo administradores pueden listar usuarios", 403, cors);
  }

  let orgId: string | null;
  try {
    orgId = await resolveOrgScope(adminClient, callerId, admin.isGlobalAdmin, admin.orgId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "403:Sin organización";
    log.finish(403, "no_org_membership", { user_id: callerId });
    return errorResponse(msg.replace(/^403:/, ""), 403, cors);
  }

  const baseRows = await listarTodosLosUsuarios(adminClient);

  const result = !admin.isGlobalAdmin && orgId
    ? await filtrarPorOrganizacion(adminClient, orgId, baseRows)
    : baseRows;

  log.finish(200, "users_listed", {
    user_id: callerId,
    organization_id: orgId ?? null,
    payload: { count: result.length, scope: admin.isGlobalAdmin ? "global" : "org" },
  });
  return jsonResponse(result, 200, cors);
}
