/**
 * Handlers por acción de la función consolidada `user-management`.
 * Cada handler conserva la lógica de autorización y validación de las
 * funciones originales (create-user, delete-user, list-users,
 * invite-client-user, list-client-users) sin cambios de comportamiento.
 */
import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

export interface HandlerCtx {
  req: Request;
  cors: Record<string, string>;
  log: { finish: (status: number, event: string, meta?: Record<string, unknown>) => void };
  callerId: string;
  adminClient: SupabaseClient;
  body: Record<string, unknown>;
}

export interface AdminAccess {
  isGlobalAdmin: boolean;
  orgId: string | null;
}

// ───────────────────────────────────────────────────────────── create ──
// Catálogo completo de roles asignables (modernos + legacy para retro-compat).
// Mantener sincronizado con `ASSIGNABLE_ROLES_ADMIN_ORG` en src/lib/roles/roleCatalog.ts
// y con el enum `public.app_role`.
const VALID_ROLES = [
  // Modernos
  "admin_org",
  "gerente_operaciones",
  "gerente_visor",
  "coordinador_logistico",
  "ejecutivo_pricing",
  "contador",
  "tesorero",
  "vendedor",
  "customer_service",
  // Legacy
  "admin",
  "operador",
  "viewer",
] as const;

// Roles que un admin_org (no global) puede asignar. Excluye `admin` y cualquier
// rol con escalado a privilegios globales — corrige privilege escalation
// reportado por el escáner de seguridad.
const ASSIGNABLE_BY_ORG_ADMIN = new Set<string>([
  "admin_org",
  "gerente_operaciones",
  "gerente_visor",
  "coordinador_logistico",
  "ejecutivo_pricing",
  "contador",
  "tesorero",
  "vendedor",
  "customer_service",
  "operador",
  "viewer",
]);

export function validateCreatePayload(body: { email?: string; password?: string }): string | null {
  if (!body.email || !body.password) return "Email y contraseña son requeridos";
  if (body.password.length < 6) return "La contraseña debe tener al menos 6 caracteres";
  return null;
}

/**
 * Resuelve la organización destino para el alta:
 * - super_admin global puede pasar `organization_id` para crear en cualquier org.
 * - admin_org siempre crea en su propia org (ignora payload).
 */
async function resolveTargetOrgId(
  adminClient: SupabaseClient,
  admin: AdminAccess,
  orgIdPayload: string | undefined,
): Promise<{ targetOrgId: string | null } | { error: string }> {
  if (!admin.isGlobalAdmin || !orgIdPayload) {
    return { targetOrgId: admin.orgId };
  }
  const { data: orgRow, error: orgErr } = await adminClient
    .from("organizations").select("id").eq("id", orgIdPayload).maybeSingle();
  if (orgErr || !orgRow) return { error: "Organización destino no encontrada" };
  return { targetOrgId: orgRow.id as string };
}

export async function handleCreate(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { cors, log, callerId, adminClient, body } = ctx;
  if (!admin.isGlobalAdmin && !admin.orgId) {
    log.finish(403, "not_admin", { user_id: callerId });
    return errorResponse("Solo administradores pueden crear usuarios", 403, cors);
  }
  const validationError = validateCreatePayload(body as { email?: string; password?: string });
  if (validationError) {
    log.finish(400, "validation_failed", { user_id: callerId });
    return errorResponse(validationError, 400, cors);
  }
  const { email, password, role, organization_id: orgIdPayload } = body as {
    email: string; password: string; role?: string; organization_id?: string;
  };
  if (!role || !(VALID_ROLES as readonly string[]).includes(role)) {
    log.finish(400, "invalid_role", { user_id: callerId, payload: { role } });
    return errorResponse(`Rol no soportado: ${role ?? "(vacío)"}`, 400, cors);
  }
  // Privilege escalation guard: un admin_org (no global) no puede asignar roles
  // con escalado a privilegios globales (admin/super_admin).
  if (!admin.isGlobalAdmin && !ASSIGNABLE_BY_ORG_ADMIN.has(role)) {
    log.finish(403, "role_not_assignable_by_org_admin", { user_id: callerId, payload: { role } });
    return errorResponse("No tienes permiso para asignar ese rol", 403, cors);
  }
  const selectedRole = role;

  const orgResolution = await resolveTargetOrgId(adminClient, admin, orgIdPayload);
  if ("error" in orgResolution) {
    log.finish(400, "invalid_organization_id", { user_id: callerId, payload: { organization_id: orgIdPayload } });
    return errorResponse(orgResolution.error, 400, cors);
  }
  const targetOrgId = orgResolution.targetOrgId;

  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email, password, email_confirm: true,
    // Evita que el trigger handle_new_user_signup cree una organización fantasma:
    // el alta desde el panel asigna explícitamente la organización destino.
    user_metadata: { skip_auto_org: true },
  });
  if (createError) {
    log.finish(400, "auth_create_failed", {
      user_id: callerId,
      organization_id: targetOrgId,
      payload: { error: createError.message },
    });
    return errorResponse(createError.message, 400, cors);
  }

  // Siempre persistir el rol seleccionado en user_roles (trigger crea uno default = viewer).
  await adminClient.from("user_roles").update({ role: selectedRole }).eq("user_id", newUser.user.id);
  if (targetOrgId) {
    const { error: memberError } = await adminClient.from("organization_members").insert({
      user_id: newUser.user.id,
      organization_id: targetOrgId,
      role: selectedRole,
    });
    if (memberError) {
      // Rollback del usuario auth para no dejar huérfanos.
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      log.finish(400, "member_insert_failed", {
        user_id: callerId,
        organization_id: targetOrgId,
        payload: { error: memberError.message },
      });
      return errorResponse(memberError.message, 400, cors);
    }
  }

  log.finish(200, "user_created", {
    user_id: callerId,
    organization_id: targetOrgId,
    payload: { new_user_id: newUser.user.id, role: selectedRole },
  });
  return jsonResponse({ user: { id: newUser.user.id, email: newUser.user.email } }, 200, cors);
}

// ───────────────────────────────────────────────────────────── delete ──
export async function handleDelete(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { cors, log, callerId, adminClient, body } = ctx;
  if (!admin.isGlobalAdmin && !admin.orgId) {
    log.finish(403, "not_admin", { user_id: callerId });
    return errorResponse("Solo administradores pueden eliminar usuarios", 403, cors);
  }
  const user_id = typeof body.user_id === "string" ? body.user_id : "";
  if (!user_id) {
    log.finish(400, "missing_user_id", { user_id: callerId });
    return errorResponse("user_id es requerido", 400, cors);
  }
  if (user_id === callerId) {
    log.finish(400, "self_delete_blocked", { user_id: callerId });
    return errorResponse("No puedes eliminar tu propia cuenta", 400, cors);
  }

  if (!admin.isGlobalAdmin && admin.orgId) {
    const { data: targetMember } = await adminClient
      .from("organization_members")
      .select("id")
      .eq("user_id", user_id)
      .eq("organization_id", admin.orgId)
      .maybeSingle();
    if (!targetMember) {
      log.finish(403, "cross_org_delete_blocked", {
        user_id: callerId,
        organization_id: admin.orgId,
        payload: { target_user_id: user_id },
      });
      return errorResponse("El usuario no pertenece a tu organización", 403, cors);
    }
    const { data: targetRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id);
    const targetIsSuperAdmin = (targetRoles ?? []).some((r: { role: string }) => r.role === "super_admin");
    if (targetIsSuperAdmin) {
      log.finish(403, "privesc_blocked_super_admin", {
        user_id: callerId,
        organization_id: admin.orgId,
        payload: { target_user_id: user_id },
      });
      return errorResponse("No tienes permiso para eliminar a un super administrador", 403, cors);
    }
  }

  await adminClient.from("organization_members").delete().eq("user_id", user_id);
  await adminClient.from("user_roles").delete().eq("user_id", user_id);

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
  if (deleteError) {
    log.finish(400, "auth_delete_failed", {
      user_id: callerId,
      payload: { target_user_id: user_id, error: deleteError.message },
    });
    return errorResponse(deleteError.message, 400, cors);
  }

  log.finish(200, "user_deleted", {
    user_id: callerId,
    organization_id: admin.orgId ?? null,
    payload: { target_user_id: user_id },
  });
  return jsonResponse({ success: true }, 200, cors);
}

// ────────────────────────────────────────────────────────────── list ──
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

export async function handleList(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { cors, log, callerId, adminClient } = ctx;

  const { data: rolesData } = await adminClient.from("user_roles").select("role").eq("user_id", callerId);
  const { data: orgRoles } = await adminClient.from("organization_members").select("role").eq("user_id", callerId);
  const ALLOWED = new Set(["admin", "admin_org", "operador", "coordinador_logistico", "ejecutivo_pricing", "gerente_operaciones", "super_admin"]);
  const allowed = [
    ...((rolesData ?? []) as Array<{ role: string }>).map((r) => r.role),
    ...((orgRoles ?? []) as Array<{ role: string }>).map((r) => r.role),
  ].some((r) => ALLOWED.has(r));
  if (!allowed) {
    log.finish(403, "role_not_allowed", { user_id: callerId });
    return errorResponse("Solo admins/operadores pueden listar usuarios", 403, cors);
  }

  let orgId: string | null;
  try {
    orgId = await resolveOrgScope(adminClient, callerId, admin.isGlobalAdmin, admin.orgId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "403:Sin organización";
    log.finish(403, "no_org_membership", { user_id: callerId });
    return errorResponse(msg.replace(/^403:/, ""), 403, cors);
  }

  const { data: { users }, error } = await adminClient.auth.admin.listUsers();
  if (error) throw error;

  const baseRows = users.map((u: { id: string; email?: string; created_at: string }) => ({
    id: u.id,
    email: u.email ?? "",
    created_at: u.created_at,
  }));

  let result = baseRows;
  if (!admin.isGlobalAdmin && orgId) {
    const { data: members } = await adminClient
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId);
    const allowedIds = new Set(((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id));
    result = baseRows.filter((u) => allowedIds.has(u.id));
  }

  log.finish(200, "users_listed", {
    user_id: callerId,
    organization_id: orgId ?? null,
    payload: { count: result.length, scope: admin.isGlobalAdmin ? "global" : "org" },
  });
  return jsonResponse(result, 200, cors);
}

// ─────────────────────────── invite-client / list-clients (extraídos) ──
export { resolveRedirectTo, handleInviteClient, handleListClients } from "./clientHandlers.ts";

