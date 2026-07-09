/**
 * Handler `delete`: baja de usuario con guardas anti privilege-escalation.
 * Extraído de `handlers.ts` para respetar Power-of-10.
 */
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import type { HandlerCtx, AdminAccess } from "./types.ts";

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
