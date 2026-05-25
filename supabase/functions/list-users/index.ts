import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate, checkAdminAccess } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

/**
 * Resuelve la organización efectiva del usuario:
 * - Si es global admin → usa la org del helper checkAdminAccess (puede ser null).
 * - Si no es admin y no hay org del helper → busca membresía explícita.
 * Lanza "403:Sin organización" si el usuario no-admin no tiene membresía.
 */
async function resolveOrgScope(
  // deno-lint-ignore no-explicit-any
  adminClient: any,
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
  const orgId = membership?.organization_id ?? null;
  if (!orgId) throw new Error("403:Sin organización");
  return orgId;
}

/**
 * Filtra la lista de usuarios al scope de la organización pedida.
 * Para global admins (orgId puede ser null) devuelve todos los users.
 */
async function filterUsersByOrg<T extends { id: string }>(
  // deno-lint-ignore no-explicit-any
  adminClient: any,
  users: T[],
  isGlobalAdmin: boolean,
  orgId: string | null,
): Promise<T[]> {
  if (isGlobalAdmin || !orgId) return users;
  const { data: members } = await adminClient
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId);
  const allowed = new Set((members ?? []).map((m: { user_id: string }) => m.user_id));
  return users.filter((u) => allowed.has(u.id));
}

Deno.serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const log = createLogger(req, "list-users");

  try {
    const { userId, adminClient } = await authenticate(req);
    const { isGlobalAdmin, orgId: adminOrgId } = await checkAdminAccess(adminClient, userId);

    // Permitir a cualquier miembro de la organización listar usuarios de su propia
    // org (necesario para selects de vendedor/responsable en CRM, auditoría, etc.).
    let orgId: string | null;
    try {
      orgId = await resolveOrgScope(adminClient, userId, isGlobalAdmin, adminOrgId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "403:Sin organización";
      log.finish(403, "no_org_membership", { user_id: userId });
      return errorResponse(msg.replace(/^403:/, ""), 403, cors);
    }

    const { data: { users }, error } = await adminClient.auth.admin.listUsers();
    if (error) throw error;

    const baseRows = users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
    }));
    const result = await filterUsersByOrg(adminClient, baseRows, isGlobalAdmin, orgId);

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
