import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate, checkAdminAccess } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const log = createLogger(req, "list-users");

  try {
    const { userId, adminClient } = await authenticate(req);
    const { isGlobalAdmin, orgId } = await checkAdminAccess(adminClient, userId);
    if (!isGlobalAdmin && !orgId) {
      log.finish(403, "not_admin", { user_id: userId });
      return errorResponse("Solo administradores", 403, cors);
    }

    const { data: { users }, error } = await adminClient.auth.admin.listUsers();
    if (error) throw error;

    let result = users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
    }));

    if (!isGlobalAdmin && orgId) {
      const { data: members } = await adminClient
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId);
      const allowed = new Set((members ?? []).map((m) => m.user_id));
      result = result.filter((u) => allowed.has(u.id));
    }

    log.finish(200, "users_listed", {
      user_id: userId,
      organization_id: orgId ?? null,
      payload: { count: result.length, scope: isGlobalAdmin ? "global" : "org" },
    });
    return jsonResponse(result, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    const [code, ...rest] = msg.split(":");
    const status = /^\d+$/.test(code) ? parseInt(code) : 500;
    log.finish(status, "unhandled_error", { payload: { error: msg } });
    return errorResponse(rest.join(":") || msg, status, cors);
  }
});
