/**
 * Handler `delete`: baja de usuario con guardas anti privilege-escalation.
 * Extraído de `handlers.ts` para respetar Power-of-10.
 */
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import type { HandlerCtx, AdminAccess } from "./types.ts";
import { mensajeSeguro } from "./errores.ts";
import { esUuid } from "../_shared/uuid.ts";

function validarDestinoBaja(ctx: HandlerCtx): { user_id: string } | { error: Response } {
  const { cors, log, callerId, body } = ctx;
  const user_id = typeof body.user_id === "string" ? body.user_id : "";
  if (!user_id) {
    log.finish(400, "missing_user_id", { user_id: callerId });
    return { error: errorResponse("user_id es requerido", 400, cors) };
  }
  if (!esUuid(user_id)) {
    log.finish(400, "validation_failed", { user_id: callerId });
    return { error: errorResponse("user_id debe ser un UUID válido", 400, cors) };
  }
  return { user_id };
}

export async function handleDelete(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { cors, log, callerId, adminClient } = ctx;
  if (!admin.isGlobalAdmin && !admin.orgId) {
    log.finish(403, "not_admin", { user_id: callerId });
    return errorResponse("Solo administradores pueden eliminar usuarios", 403, cors);
  }
  const destino = validarDestinoBaja(ctx);
  if ("error" in destino) return destino.error;
  const { user_id } = destino;
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
    try {
      const { data: targetRoles, error: rolesError } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user_id);
      if (rolesError) throw rolesError;
      const targetIsSuperAdmin = (targetRoles ?? []).some((r: { role: string }) => r.role === "super_admin");
      if (targetIsSuperAdmin) {
        log.finish(403, "privesc_blocked_super_admin", {
          user_id: callerId,
          organization_id: admin.orgId,
          payload: { target_user_id: user_id },
        });
        return errorResponse("No tienes permiso para eliminar a un super administrador", 403, cors);
      }
    } catch (error) {
      log.finish(500, "target_roles_lookup_failed", {
        user_id: callerId,
        organization_id: admin.orgId,
        payload: { target_user_id: user_id, error: error instanceof Error ? error.message : error },
      });
      return errorResponse(mensajeSeguro(null), 500, cors);
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
    return errorResponse(
      mensajeSeguro(
        deleteError.message,
        "LC_USUARIO_BAJA_FALLIDA: No se pudo eliminar la cuenta en el proveedor de identidad.",
      ),
      400,
      cors,
    );
  }

  log.finish(200, "user_deleted", {
    user_id: callerId,
    organization_id: admin.orgId ?? null,
    payload: { target_user_id: user_id },
  });
  return jsonResponse({ success: true }, 200, cors);
}
