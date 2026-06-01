import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate, checkAdminAccess } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

/** Parse y valida el body de la request. Devuelve null si es inválido. */
export function parseDeleteBody(raw: unknown): { user_id: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.user_id !== "string" || !r.user_id) return null;
  return { user_id: r.user_id };
}

/** Devuelve mensaje de error si la operación de delete no está permitida (self-delete o target vacío). */
export function assertCanDelete(callerId: string, targetId: string): string | null {
  if (!targetId) return "user_id es requerido";
  if (targetId === callerId) return "No puedes eliminar tu propia cuenta";
  return null;
}


Deno.serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const log = createLogger(req, "delete-user");

  try {
    const { userId: callerId, adminClient } = await authenticate(req);
    const { isGlobalAdmin, orgId: callerOrgId } = await checkAdminAccess(adminClient, callerId);

    if (!isGlobalAdmin && !callerOrgId) {
      log.finish(403, "not_admin", { user_id: callerId });
      return errorResponse("Solo administradores pueden eliminar usuarios", 403, cors);
    }

    const { user_id } = await req.json();
    if (!user_id) {
      log.finish(400, "missing_user_id", { user_id: callerId });
      return errorResponse("user_id es requerido", 400, cors);
    }
    if (user_id === callerId) {
      log.finish(400, "self_delete_blocked", { user_id: callerId });
      return errorResponse("No puedes eliminar tu propia cuenta", 400, cors);
    }

    if (!isGlobalAdmin && callerOrgId) {
      const { data: targetMember } = await adminClient
        .from("organization_members")
        .select("id")
        .eq("user_id", user_id)
        .eq("organization_id", callerOrgId)
        .maybeSingle();
      if (!targetMember) {
        log.finish(403, "cross_org_delete_blocked", {
          user_id: callerId,
          organization_id: callerOrgId,
          payload: { target_user_id: user_id },
        });
        return errorResponse("El usuario no pertenece a tu organización", 403, cors);
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
      organization_id: callerOrgId ?? null,
      payload: { target_user_id: user_id },
    });
    return jsonResponse({ success: true }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    const [code, ...rest] = msg.split(":");
    const status = /^\d+$/.test(code) ? parseInt(code) : 500;
    log.finish(status, "unhandled_error", { payload: { error: msg } });
    return errorResponse(rest.join(":") || msg, status, cors);
  }
});
