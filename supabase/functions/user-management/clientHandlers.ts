/**
 * Handlers de invitación y listado de usuarios cliente.
 * Extraído de `handlers.ts` para mantener archivos < 250 líneas.
 */
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import type { HandlerCtx, AdminAccess } from "./handlers.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

export function resolveRedirectTo(rawOrigin: string): string {
  const ALLOWED_REDIRECT_ORIGINS = new Set<string>([
    "https://elogistix.lovable.app",
    "https://id-preview--341dfc00-0308-4aba-9246-e4b2041e31f1.lovable.app",
  ]);
  const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(rawOrigin);
  const safeOrigin = ALLOWED_REDIRECT_ORIGINS.has(rawOrigin) || isLocalhost
    ? rawOrigin
    : "https://elogistix.lovable.app";
  return `${safeOrigin}/portal/login`;
}

function validateInviteInput(body: Record<string, unknown>): { email: string; cliente_id: string; organization_id: string } | string {
  const email = typeof body.email === "string" ? body.email : "";
  const cliente_id = typeof body.cliente_id === "string" ? body.cliente_id : "";
  const organization_id = typeof body.organization_id === "string" ? body.organization_id : "";
  if (!email || !cliente_id || !organization_id) {
    return "Faltan campos requeridos: email, cliente_id, organization_id";
  }
  return { email, cliente_id, organization_id };
}

async function ensureClienteEnOrg(
  adminClient: SupabaseClient,
  cliente_id: string,
  organization_id: string,
): Promise<boolean> {
  const { data: cliente } = await adminClient
    .from("clientes")
    .select("id, organization_id")
    .eq("id", cliente_id)
    .maybeSingle();
  return !!cliente && (cliente as { organization_id: string }).organization_id === organization_id;
}

async function inviteOrLinkUser(
  adminClient: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<{ userId: string; isNew: boolean } | { error: string }> {
  const { data: existing } = await adminClient
    .schema("auth")
    .from("users")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    await adminClient.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    await anon.auth.resetPasswordForEmail(email, { redirectTo });
    return { userId: (existing as { id: string }).id, isNew: false };
  }

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    // R2-16: `skip_auto_org=true` evita que `handle_new_user_signup` cree una
    // organización fantasma y asigne el rol default `admin_org` a un usuario
    // de portal cliente. El rol correcto se fija en `ensureClienteRole`.
    data: { role: "cliente", skip_auto_org: true },
  });
  if (error || !data.user) {
    return { error: error?.message ?? "Error desconocido al invitar" };
  }
  return { userId: data.user.id, isNew: true };
}

async function ensureClienteRole(adminClient: SupabaseClient, userId: string): Promise<void> {
  // R2-16: forzar rol='cliente' aunque el trigger haya creado uno default.
  const { data: existingRole } = await adminClient
    .from("user_roles").select("id").eq("user_id", userId).maybeSingle();
  if (!existingRole) {
    await adminClient.from("user_roles").insert({ user_id: userId, role: "cliente" });
  } else {
    await adminClient.from("user_roles").update({ role: "cliente" }).eq("user_id", userId);
  }
}

export async function handleInviteClient(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { req, cors, log, callerId, adminClient, body } = ctx;
  if (!admin.isGlobalAdmin && !admin.orgId) {
    log.finish(403, "not_admin", { user_id: callerId });
    return errorResponse("Solo administradores", 403, cors);
  }

  const inputOrErr = validateInviteInput(body);
  if (typeof inputOrErr === "string") {
    log.finish(400, "missing_fields", { user_id: callerId });
    return errorResponse(inputOrErr, 400, cors);
  }
  const { email, cliente_id, organization_id } = inputOrErr;

  if (!admin.isGlobalAdmin && admin.orgId !== organization_id) {
    log.finish(403, "cross_org_invite_blocked", {
      user_id: callerId, organization_id: admin.orgId, payload: { target_org: organization_id },
    });
    return errorResponse("No autorizado para invitar usuarios a esa organización", 403, cors);
  }

  const clienteOk = await ensureClienteEnOrg(adminClient, cliente_id, organization_id);
  if (!clienteOk) {
    log.finish(400, "invalid_cliente", { user_id: callerId, organization_id, payload: { cliente_id } });
    return errorResponse("Cliente inválido para esa organización", 400, cors);
  }

  const redirectTo = resolveRedirectTo(req.headers.get("origin") ?? "");
  const inviteResult = await inviteOrLinkUser(adminClient, email, redirectTo);
  if ("error" in inviteResult) {
    log.finish(500, "invite_email_failed", { organization_id, payload: { error: inviteResult.error } });
    return errorResponse(`Error al invitar usuario: ${inviteResult.error}`, 500, cors);
  }
  const { userId, isNew } = inviteResult;

  await ensureClienteRole(adminClient, userId);

  const { error: linkError } = await adminClient
    .from("client_users")
    .upsert(
      { user_id: userId, cliente_id, organization_id },
      { onConflict: "user_id,cliente_id" },
    );
  if (linkError) {
    log.finish(500, "link_failed", { organization_id, payload: { user_id: userId, error: linkError.message } });
    return errorResponse(`Error al vincular usuario: ${linkError.message}`, 500, cors);
  }

  log.finish(200, "client_user_invited", {
    organization_id,
    payload: { user_id: userId, is_new: isNew, cliente_id },
  });
  return jsonResponse({ success: true, user_id: userId, is_new: isNew }, 200, cors);
}

async function authorizeListClients(
  adminClient: SupabaseClient,
  callerId: string,
  clienteOrgId: string,
): Promise<boolean> {
  const { data: superRole } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (superRole) return true;
  const { data: member } = await adminClient
    .from("organization_members")
    .select("role")
    .eq("user_id", callerId)
    .eq("organization_id", clienteOrgId)
    .in("role", ["admin", "admin_org", "operador", "coordinador_logistico", "ejecutivo_pricing", "gerente_operaciones"])
    .maybeSingle();
  return !!member;
}

export async function handleListClients(ctx: HandlerCtx): Promise<Response> {
  const { cors, log, callerId, adminClient, body } = ctx;
  const cliente_id = typeof body.cliente_id === "string" ? body.cliente_id : "";
  if (!cliente_id) {
    log.finish(400, "missing_fields", { user_id: callerId });
    return errorResponse("Falta cliente_id", 400, cors);
  }

  const { data: cliente, error: clienteErr } = await adminClient
    .from("clientes")
    .select("id, organization_id")
    .eq("id", cliente_id)
    .maybeSingle();
  if (clienteErr || !cliente) {
    log.finish(404, "cliente_not_found", { user_id: callerId });
    return errorResponse("Cliente no encontrado", 404, cors);
  }
  const clienteOrgId = (cliente as { organization_id: string }).organization_id;

  const allowed = await authorizeListClients(adminClient, callerId, clienteOrgId);
  if (!allowed) {
    log.finish(403, "forbidden", { user_id: callerId, organization_id: clienteOrgId });
    return errorResponse("No autorizado", 403, cors);
  }

  const { data: links, error: linksErr } = await adminClient
    .from("client_users")
    .select("id, user_id, cliente_id, organization_id, created_at")
    .eq("cliente_id", cliente_id);
  if (linksErr) throw linksErr;

  const rows = await Promise.all(
    ((links ?? []) as Array<{
      id: string; user_id: string; cliente_id: string; organization_id: string; created_at: string;
    }>).map(async (l) => {
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
    user_id: callerId,
    organization_id: clienteOrgId,
    payload: { count: rows.length, cliente_id },
  });
  return jsonResponse(rows, 200, cors);
}
