import { handlePreflight } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate, checkAdminAccess } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const { userId: callerId, adminClient } = await authenticate(req);
    const { isGlobalAdmin, orgId: callerOrgId } = await checkAdminAccess(adminClient, callerId);

    if (!isGlobalAdmin && !callerOrgId) {
      return errorResponse("Solo administradores pueden eliminar usuarios", 403);
    }

    const { user_id } = await req.json();
    if (!user_id) return errorResponse("user_id es requerido", 400);
    if (user_id === callerId) return errorResponse("No puedes eliminar tu propia cuenta", 400);

    // If org admin (not global), verify target user belongs to their org
    if (!isGlobalAdmin && callerOrgId) {
      const { data: targetMember } = await adminClient
        .from("organization_members")
        .select("id")
        .eq("user_id", user_id)
        .eq("organization_id", callerOrgId)
        .maybeSingle();
      if (!targetMember) {
        return errorResponse("El usuario no pertenece a tu organización", 403);
      }
    }

    await adminClient.from("organization_members").delete().eq("user_id", user_id);
    await adminClient.from("user_roles").delete().eq("user_id", user_id);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
    if (deleteError) return errorResponse(deleteError.message, 400);

    return jsonResponse({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    const [code, ...rest] = msg.split(":");
    const status = /^\d+$/.test(code) ? parseInt(code) : 500;
    return errorResponse(rest.join(":") || msg, status);
  }
});
