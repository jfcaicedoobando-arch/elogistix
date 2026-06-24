/**
 * Handlers de invitación y listado de usuarios del Portal del Agente de Carga.
 * Espejo de `clientHandlers.ts` (portal cliente) adaptado a la tabla `agente_users`
 * y al rol `agente_carga`.
 */
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import type { HandlerCtx, AdminAccess } from "./handlers.ts";
import { resolveRedirectTo } from "./clientHandlers.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

function validateInviteAgente(body: Record<string, unknown>):
  | { email: string; agente_id: string; organization_id: string; mode: "email" | "password"; password?: string }
  | string {
  const email = typeof body.email === "string" ? body.email : "";
  const agente_id = typeof body.agente_id === "string" ? body.agente_id : "";
  const organization_id = typeof body.organization_id === "string" ? body.organization_id : "";
  const rawMode = typeof body.mode === "string" ? body.mode : "email";
  const mode: "email" | "password" = rawMode === "password" ? "password" : "email";
  const password = typeof body.password === "string" ? body.password : undefined;
  if (!email || !agente_id || !organization_id) {
    return "Faltan campos requeridos: email, agente_id, organization_id";
  }
  if (mode === "password") {
    if (!password || password.length < 8) {
      return "La contraseña debe tener al menos 8 caracteres";
    }
  }
  return { email, agente_id, organization_id, mode, password };
}

async function ensureAgenteEnOrg(
  adminClient: SupabaseClient,
  agente_id: string,
  organization_id: string,
): Promise<boolean> {
  const { data: a } = await adminClient
    .from("costeo_agentes")
    .select("id, organization_id")
    .eq("id", agente_id)
    .maybeSingle();
  return !!a && (a as { organization_id: string }).organization_id === organization_id;
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
    data: { role: "agente_carga" },
  });
  if (error || !data.user) {
    return { error: error?.message ?? "Error desconocido al invitar" };
  }
  return { userId: data.user.id, isNew: true };
}

/**
 * Modo "password": el admin asigna la contraseña directamente (útil cuando el
 * email no llega — agentes en China). Si el usuario existe, le reescribe la
 * contraseña; si no, crea la cuenta ya confirmada para que pueda entrar al toque.
 * La contraseña jamás se loggea ni se devuelve en la respuesta.
 */
async function createOrResetUserWithPassword(
  adminClient: SupabaseClient,
  email: string,
  password: string,
): Promise<{ userId: string; isNew: boolean } | { error: string }> {
  const { data: existing } = await adminClient
    .schema("auth")
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    const userId = (existing as { id: string }).id;
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (error) return { error: error.message };
    return { userId, isNew: false };
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "agente_carga" },
  });
  if (error || !data.user) {
    return { error: error?.message ?? "Error al crear usuario" };
  }
  return { userId: data.user.id, isNew: true };
}

async function ensureAgenteRole(adminClient: SupabaseClient, userId: string): Promise<void> {
  const { data: existing } = await adminClient
    .from("user_roles").select("id").eq("user_id", userId).maybeSingle();
  if (!existing) {
    await adminClient.from("user_roles").insert({ user_id: userId, role: "agente_carga" });
  } else {
    // Garantizar rol correcto (el trigger crea uno default).
    await adminClient.from("user_roles").update({ role: "agente_carga" }).eq("user_id", userId);
  }
}

type InviteInput = {
  email: string;
  agente_id: string;
  organization_id: string;
  mode: "email" | "password";
  password?: string;
};

type InviteResult = { userId: string; isNew: boolean } | { error: string };

async function executeInvitePath(
  adminClient: SupabaseClient,
  originHeader: string,
  input: InviteInput,
): Promise<InviteResult> {
  if (input.mode === "password") {
    return await createOrResetUserWithPassword(adminClient, input.email, input.password!);
  }
  const baseRedirect = resolveRedirectTo(originHeader);
  const redirectTo = baseRedirect.replace(/\/portal\/login$/, "/login");
  return await inviteOrLinkUser(adminClient, input.email, redirectTo);
}

async function registrarBitacoraPassword(
  adminClient: SupabaseClient,
  callerId: string,
  organization_id: string,
  agente_id: string,
  email: string,
  userId: string,
  isNew: boolean,
): Promise<void> {
  const { data: userRow } = await adminClient
    .schema("auth").from("users").select("email").eq("id", callerId).maybeSingle();
  const accion = isNew
    ? "Agente: cuenta creada con contraseña"
    : "Agente: contraseña reasignada por admin";
  await adminClient.from("bitacora_actividad").insert({
    organization_id,
    usuario_id: callerId,
    usuario_email: (userRow as { email?: string } | null)?.email ?? "",
    modulo: "Costeo Agentes",
    accion,
    entidad_id: agente_id,
    entidad_nombre: email,
    detalles: { user_id: userId, mode: "password" },
  });
}

export async function handleInviteAgente(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { req, cors, log, callerId, adminClient, body } = ctx;
  if (!admin.isGlobalAdmin && !admin.orgId) {
    log.finish(403, "not_admin", { user_id: callerId });
    return errorResponse("Solo administradores", 403, cors);
  }
  const inputOrErr = validateInviteAgente(body);
  if (typeof inputOrErr === "string") {
    log.finish(400, "missing_fields", { user_id: callerId });
    return errorResponse(inputOrErr, 400, cors);
  }
  const { email, agente_id, organization_id, mode, password } = inputOrErr;
  const isPasswordMode = mode === "password";

  if (!admin.isGlobalAdmin && admin.orgId !== organization_id) {
    log.finish(403, "cross_org_invite_blocked", {
      user_id: callerId, organization_id: admin.orgId, payload: { target_org: organization_id },
    });
    return errorResponse("No autorizado para invitar agentes de esa organización", 403, cors);
  }

  const ok = await ensureAgenteEnOrg(adminClient, agente_id, organization_id);
  if (!ok) {
    log.finish(400, "invalid_agente", { user_id: callerId, organization_id, payload: { agente_id } });
    return errorResponse("Agente inválido para esa organización", 400, cors);
  }

  const originHeader = req.headers.get("origin") ?? "";
  const inviteResult = await executeInvitePath(adminClient, originHeader, { email, agente_id, organization_id, mode, password });

  if ("error" in inviteResult) {
    const reason = isPasswordMode ? "create_with_password_failed" : "invite_email_failed";
    const errPrefix = isPasswordMode ? "Error al crear cuenta del agente" : "Error al invitar agente";
    log.finish(500, reason, { organization_id, payload: { error: inviteResult.error } });
    return errorResponse(`${errPrefix}: ${inviteResult.error}`, 500, cors);
  }
  const { userId, isNew } = inviteResult;

  await ensureAgenteRole(adminClient, userId);

  const { error: linkError } = await adminClient
    .from("agente_users")
    .upsert(
      { user_id: userId, agente_id, organization_id },
      { onConflict: "user_id,agente_id" },
    );
  if (linkError) {
    log.finish(500, "link_failed", { organization_id, payload: { user_id: userId, error: linkError.message } });
    return errorResponse(`Error al vincular agente: ${linkError.message}`, 500, cors);
  }

  if (isPasswordMode) {
    await registrarBitacoraPassword(adminClient, callerId, organization_id, agente_id, email, userId, isNew);
  }

  const finishReason = isPasswordMode ? "agente_user_created_with_password" : "agente_user_invited";
  log.finish(200, finishReason, {
    organization_id,
    payload: { user_id: userId, is_new: isNew, agente_id, mode },
  });
  return jsonResponse({ success: true, user_id: userId, is_new: isNew, mode_used: mode }, 200, cors);
}

export async function handleListAgentes(ctx: HandlerCtx): Promise<Response> {
  const { cors, log, callerId, adminClient, body } = ctx;
  const agente_id = typeof body.agente_id === "string" ? body.agente_id : "";
  if (!agente_id) {
    log.finish(400, "missing_fields", { user_id: callerId });
    return errorResponse("Falta agente_id", 400, cors);
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
