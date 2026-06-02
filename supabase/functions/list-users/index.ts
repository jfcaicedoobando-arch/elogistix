import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate, checkAdminAccess } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

// Tipo mínimo del admin client de Supabase usado por estos helpers. Evitamos
// `any` para cumplir con el guardrail `no-explicit-any`; sólo declaramos los
// métodos que tocamos (subset estructural seguro).
type AdminClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        limit: (n: number) => { maybeSingle: () => Promise<{ data: { organization_id?: string } | null }> };
      } & Promise<{ data: Array<{ user_id: string }> | null }>;
    };
  };
};

/**
 * Resuelve la organización efectiva del usuario:
 * - Si es global admin → usa la org del helper checkAdminAccess (puede ser null).
 * - Si no es admin y no hay org del helper → busca membresía explícita.
 * Lanza "403:Sin organización" si el usuario no-admin no tiene membresía.
 */
export async function resolveOrgScope(
  adminClient: AdminClient,
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
export async function filterUsersByOrg<T extends { id: string }>(
  adminClient: AdminClient,
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

    // 12.32.0: restringir a roles admin/operador/super_admin (no viewer/cliente).
    const { data: rolesData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const globalRoles = new Set((rolesData ?? []).map((r: { role: string }) => r.role));
    const { data: orgRoles } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("user_id", userId);
    const orgRoleSet = new Set((orgRoles ?? []).map((r: { role: string }) => r.role));
    const ALLOWED = new Set(["admin", "operador", "super_admin"]);
    const allowed = [...globalRoles, ...orgRoleSet].some((r) => ALLOWED.has(r));
    if (!allowed) {
      log.finish(403, "role_not_allowed", { user_id: userId });
      return errorResponse("Solo admins/operadores pueden listar usuarios", 403, cors);
    }

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
