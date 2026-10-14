/**
 * Handler `set-active`: desactiva (bloquea el inicio de sesión) o reactiva una
 * cuenta sin borrarla. Mismos guards que `delete`; además, un admin de
 * organización no puede bloquear a quien pertenece a otras organizaciones,
 * porque el bloqueo es de la cuenta completa.
 */
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import type { HandlerCtx, AdminAccess } from "./types.ts";

/** ~100 años: equivalente a "sin fecha de fin". */
const BAN_INDEFINIDO = "876000h";

export async function handleSetActive(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { cors, log, callerId, adminClient, body } = ctx;
  if (!admin.isGlobalAdmin && !admin.orgId) {
    log.finish(403, "not_admin", { user_id: callerId });
    return errorResponse("Solo administradores pueden desactivar usuarios", 403, cors);
  }
  const user_id = typeof body.user_id === "string" ? body.user_id : "";
  if (!user_id || typeof body.activo !== "boolean") {
    log.finish(400, "invalid_payload", { user_id: callerId });
    return errorResponse("user_id y activo son requeridos", 400, cors);
  }
  const activo = body.activo;
  if (user_id === callerId) {
    log.finish(400, "self_deactivate_blocked", { user_id: callerId });
    return errorResponse("No puedes desactivar tu propia cuenta", 400, cors);
  }

  if (!admin.isGlobalAdmin && admin.orgId) {
    const { data: membresias } = await adminClient
      .from("organization_members").select("organization_id").eq("user_id", user_id);
    const orgs = ((membresias ?? []) as Array<{ organization_id: string }>).map((m) => m.organization_id);
    if (!orgs.includes(admin.orgId)) {
      log.finish(403, "cross_org_blocked", { user_id: callerId, payload: { target_user_id: user_id } });
      return errorResponse("El usuario no pertenece a tu organización", 403, cors);
    }
    if (orgs.some((o) => o !== admin.orgId)) {
      log.finish(403, "multi_org_blocked", { user_id: callerId, payload: { target_user_id: user_id } });
      return errorResponse("El usuario también pertenece a otra organización; usa «Quitar de la organización»", 403, cors);
    }
    const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", user_id);
    if ((roles ?? []).some((r: { role: string }) => r.role === "super_admin")) {
      log.finish(403, "privesc_blocked_super_admin", { user_id: callerId, payload: { target_user_id: user_id } });
      return errorResponse("No tienes permiso para desactivar a un super administrador", 403, cors);
    }
  }

  const { error } = await adminClient.auth.admin.updateUserById(user_id, {
    ban_duration: activo ? "none" : BAN_INDEFINIDO,
  });
  if (error) {
    log.finish(400, "set_active_failed", { user_id: callerId, payload: { target_user_id: user_id, error: error.message } });
    return errorResponse("LC_USUARIO_ESTADO_FALLIDO: No se pudo cambiar el acceso del usuario.", 400, cors);
  }

  log.finish(200, activo ? "user_reactivated" : "user_deactivated", {
    user_id: callerId, organization_id: admin.orgId ?? null, payload: { target_user_id: user_id },
  });
  return jsonResponse({ success: true }, 200, cors);
}
