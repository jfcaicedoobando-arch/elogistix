/**
 * Handler `list`: listado de usuarios con scope por organización.
 * Extraído de `handlers.ts` para respetar Power-of-10.
 */
import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import type { HandlerCtx, AdminAccess } from "./types.ts";

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
