// @ts-expect-error Deno remote import
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

interface Body { cliente_id: string }

function parseBody(raw: unknown): Body | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.cliente_id !== "string" || !r.cliente_id) return null;
  return { cliente_id: r.cliente_id };
}

/**
 * Verifica que el caller sea super_admin o miembro (admin/operador) de la
 * organización a la que pertenece el cliente.
 */
async function authorizeCaller(
  adminClient: SupabaseClient,
  userId: string,
  clienteOrgId: string,
): Promise<boolean> {
  const { data: superRole } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (superRole) return true;

  const { data: member } = await adminClient
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", clienteOrgId)
    .in("role", ["admin", "operador"])
    .maybeSingle();
  return !!member;
}

Deno.serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const log = createLogger(req, "list-client-users");

  try {
    const { userId, adminClient } = await authenticate(req);
    const body = parseBody(await req.json().catch(() => null));
    if (!body) {
      log.finish(400, "missing_fields", { user_id: userId });
      return errorResponse("Falta cliente_id", 400, cors);
    }

    const { data: cliente, error: clienteErr } = await adminClient
      .from("clientes")
      .select("id, organization_id")
      .eq("id", body.cliente_id)
      .maybeSingle();
    if (clienteErr || !cliente) {
      log.finish(404, "cliente_not_found", { user_id: userId });
      return errorResponse("Cliente no encontrado", 404, cors);
    }

    const allowed = await authorizeCaller(adminClient, userId, cliente.organization_id);
    if (!allowed) {
      log.finish(403, "forbidden", { user_id: userId, organization_id: cliente.organization_id });
      return errorResponse("No autorizado", 403, cors);
    }

    const { data: links, error: linksErr } = await adminClient
      .from("client_users")
      .select("id, user_id, cliente_id, organization_id, created_at")
      .eq("cliente_id", body.cliente_id);
    if (linksErr) throw linksErr;

    const rows = await Promise.all(
      (links ?? []).map(async (l) => {
        const { data: u } = await adminClient.auth.admin.getUserById(l.user_id);
        return {
          id: l.id,
          user_id: l.user_id,
          cliente_id: l.cliente_id,
          organization_id: l.organization_id,
          created_at: l.created_at,
          email: u?.user?.email ?? "(desconocido)",
          last_sign_in_at: u?.user?.last_sign_in_at ?? null,
          email_confirmed_at: u?.user?.email_confirmed_at ?? null,
        };
      }),
    );

    log.finish(200, "client_users_listed", {
      user_id: userId,
      organization_id: cliente.organization_id,
      payload: { count: rows.length, cliente_id: body.cliente_id },
    });
    return jsonResponse(rows, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    const [code, ...rest] = msg.split(":");
    const status = /^\d+$/.test(code) ? parseInt(code) : 500;
    log.finish(status, "unhandled_error", { payload: { error: msg } });
    return errorResponse(rest.join(":") || msg, status, cors);
  }
});
