/**
 * Handler para listar usuarios vinculados a un agente de carga.
 * Extraído de `agenteHandlers.ts` para respetar el límite de líneas.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import type { HandlerCtx } from "./handlers.ts";

async function authorizeListAgentes(
  adminClient: SupabaseClient,
  callerId: string,
  agenteOrgId: string,
): Promise<boolean> {
  const { data: superRole } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .in("role", ["super_admin", "admin"])
    .maybeSingle();
  if (superRole) return true;
  const { data: member } = await adminClient
    .from("organization_members")
    .select("role")
    .eq("user_id", callerId)
    .eq("organization_id", agenteOrgId)
    .in("role", ["admin", "admin_org", "operador", "coordinador_logistico", "ejecutivo_pricing", "gerente_operaciones"])
    .maybeSingle();
  return !!member;
}

export async function handleListAgentes(ctx: HandlerCtx): Promise<Response> {
  const { cors, log, callerId, adminClient, body } = ctx;
  const agente_id = typeof body.agente_id === "string" ? body.agente_id : "";
  if (!agente_id) {
    log.finish(400, "missing_fields", { user_id: callerId });
    return errorResponse("Falta agente_id", 400, cors);
  }

  const { data: agenteRow, error: agenteErr } = await adminClient
    .from("costeo_agentes")
    .select("id, organization_id")
    .eq("id", agente_id)
    .maybeSingle();
  if (agenteErr || !agenteRow) {
    log.finish(404, "agente_not_found", { user_id: callerId });
    return errorResponse("Agente no encontrado", 404, cors);
  }
  const agenteOrgId = (agenteRow as { organization_id: string }).organization_id;

  const allowed = await authorizeListAgentes(adminClient, callerId, agenteOrgId);
  if (!allowed) {
    log.finish(403, "forbidden", { user_id: callerId, organization_id: agenteOrgId });
    return errorResponse("No autorizado", 403, cors);
  }

  const { data: links, error } = await adminClient
    .from("agente_users")
    .select("id, user_id, agente_id, organization_id, created_at")
    .eq("agente_id", agente_id);
  if (error) throw error;

  const rows = await Promise.all(
    ((links ?? []) as Array<{
      id: string; user_id: string; agente_id: string; organization_id: string; created_at: string;
    }>).map(async (l) => {
      const { data: u } = await adminClient.auth.admin.getUserById(l.user_id);
      return {
        id: l.id,
        user_id: l.user_id,
        agente_id: l.agente_id,
        organization_id: l.organization_id,
        created_at: l.created_at,
        email: u?.user?.email ?? "(desconocido)",
        last_sign_in_at: u?.user?.last_sign_in_at ?? null,
        email_confirmed_at: u?.user?.email_confirmed_at ?? null,
      };
    }),
  );

  log.finish(200, "agente_users_listed", {
    user_id: callerId,
    payload: { count: rows.length, agente_id },
  });
  return jsonResponse(rows, 200, cors);
}
