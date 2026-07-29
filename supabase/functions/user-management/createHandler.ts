/**
 * Handler `create`: alta de usuario por admin_org o super_admin global.
 * Extraído de `handlers.ts` para respetar Power-of-10.
 */
import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import type { HandlerCtx, AdminAccess } from "./types.ts";
import { VALID_ROLES, ASSIGNABLE_BY_ORG_ADMIN } from "./types.ts";

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
    // Q-05: mensaje claro para email duplicado (el proveedor devuelve textos variados).
    const dup = /already|registered|exists|duplicate/i.test(createError.message);
    if (dup) {
      log.finish(409, "duplicate_email", { user_id: callerId, organization_id: targetOrgId });
      return errorResponse(`Ya existe una cuenta con el correo ${email}.`, 409, cors);
    }
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
