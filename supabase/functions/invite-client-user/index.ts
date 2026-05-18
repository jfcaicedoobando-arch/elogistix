// @ts-expect-error Deno remote import
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate, checkAdminAccess } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

interface InviteBody { email: string; cliente_id: string; organization_id: string; }

function parseBody(raw: unknown): InviteBody | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.email !== "string" || typeof r.cliente_id !== "string" || typeof r.organization_id !== "string") {
    return null;
  }
  return { email: r.email, cliente_id: r.cliente_id, organization_id: r.organization_id };
}

async function verifyClienteOrg(adminClient: SupabaseClient, cliente_id: string, organization_id: string) {
  const { data: cliente, error } = await adminClient
    .from("clientes")
    .select("id, organization_id")
    .eq("id", cliente_id)
    .maybeSingle();
  return !error && cliente && cliente.organization_id === organization_id;
}

async function findExistingUser(adminClient: SupabaseClient, email: string) {
  const { data } = await adminClient.auth.admin.listUsers();
  return data?.users?.find(
    (u: { email?: string | null }) => u.email?.toLowerCase() === email.toLowerCase(),
  );
}

async function resolveUserId(
  adminClient: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<{ userId: string; isNew: boolean } | { error: string }> {
  const existing = await findExistingUser(adminClient, email);
  if (existing) {
    await adminClient.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
    const anon = createClient(
      // @ts-expect-error Deno global
      Deno.env.get("SUPABASE_URL")!,
      // @ts-expect-error Deno global
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    await anon.auth.resetPasswordForEmail(email, { redirectTo });
    return { userId: existing.id, isNew: false };
  }
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { role: "cliente" },
  });
  if (error || !data.user) return { error: error?.message ?? "Error desconocido al invitar" };
  return { userId: data.user.id, isNew: true };
}

async function ensureClienteRole(adminClient: SupabaseClient, userId: string) {
  const { data } = await adminClient.from("user_roles").select("id").eq("user_id", userId).maybeSingle();
  if (!data) {
    await adminClient.from("user_roles").insert({ user_id: userId, role: "cliente" });
  }
}

Deno.serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const log = createLogger(req, "invite-client-user");

  try {
    const { userId, adminClient } = await authenticate(req);
    const { isGlobalAdmin, orgId: callerOrgId } = await checkAdminAccess(adminClient, userId);
    if (!isGlobalAdmin && !callerOrgId) {
      log.finish(403, "not_admin", { user_id: userId });
      return errorResponse("Solo administradores", 403, cors);
    }

    const body = parseBody(await req.json().catch(() => null));
    if (!body) {
      log.finish(400, "missing_fields", { user_id: userId });
      return errorResponse("Faltan campos requeridos: email, cliente_id, organization_id", 400, cors);
    }
    const { email, cliente_id, organization_id } = body;

    if (!isGlobalAdmin && callerOrgId !== organization_id) {
      log.finish(403, "cross_org_invite_blocked", {
        user_id: userId, organization_id: callerOrgId, payload: { target_org: organization_id },
      });
      return errorResponse("No autorizado para invitar usuarios a esa organización", 403, cors);
    }

    const valido = await verifyClienteOrg(adminClient, cliente_id, organization_id);
    if (!valido) {
      log.finish(400, "invalid_cliente", { user_id: userId, organization_id, payload: { cliente_id } });
      return errorResponse("Cliente inválido para esa organización", 400, cors);
    }

    const redirectTo = `${req.headers.get("origin") || "https://elogistix.lovable.app"}/portal/login`;
    const resolved = await resolveUserId(adminClient, email, redirectTo);
    if ("error" in resolved) {
      console.error("Error inviting user:", resolved.error);
      log.finish(500, "invite_email_failed", { organization_id, payload: { error: resolved.error } });
      return errorResponse(`Error al invitar usuario: ${resolved.error}`, 500, cors);
    }

    await ensureClienteRole(adminClient, resolved.userId);

    const { error: linkError } = await adminClient
      .from("client_users")
      .upsert(
        { user_id: resolved.userId, cliente_id, organization_id },
        { onConflict: "user_id,cliente_id" },
      );
    if (linkError) {
      console.error("Error linking user:", linkError);
      log.finish(500, "link_failed", { organization_id, payload: { user_id: resolved.userId, error: linkError.message } });
      return errorResponse(`Error al vincular usuario: ${linkError.message}`, 500, cors);
    }

    log.finish(200, "client_user_invited", {
      organization_id,
      payload: { user_id: resolved.userId, is_new: resolved.isNew, cliente_id },
    });
    return jsonResponse({ success: true, user_id: resolved.userId, is_new: resolved.isNew }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const [code, ...rest] = msg.split(":");
    const status = /^\d+$/.test(code) ? parseInt(code) : 500;
    console.error("invite-client-user error:", msg);
    log.finish(status, "unhandled_error", { payload: { error: msg } });
    return errorResponse(rest.join(":") || msg, status, cors);
  }
});
