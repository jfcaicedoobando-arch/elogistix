/**
 * Handlers del ciclo de vida de la cuenta (U-03 / U-04, auditoría 2026-07-30):
 *  - "invite"         → alta por invitación por correo (sin contraseña temporal)
 *  - "reset-password" → dispara el correo de restablecimiento de contraseña
 *
 * Ambos exigen `authenticate` + `checkAdminAccess` en el router y bloquean la
 * auto-modificación cuando aplica.
 */
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import type { HandlerCtx, AdminAccess } from "./types.ts";
import { VALID_ROLES, ASSIGNABLE_BY_ORG_ADMIN } from "./types.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function anonClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
}

async function resolverOrg(
  adminClient: SupabaseClient,
  admin: AdminAccess,
  orgIdPayload: string | undefined,
): Promise<string | null> {
  if (!admin.isGlobalAdmin || !orgIdPayload) return admin.orgId;
  const { data } = await adminClient
    .from("organizations").select("id").eq("id", orgIdPayload).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Valida permisos y payload de la invitación. Devuelve `Response` si falla. */
function validarInvitacion(
  ctx: HandlerCtx,
  admin: AdminAccess,
): { error: Response } | { email: string; role: string } {
  const { cors, log, callerId, body } = ctx;
  const { email, role } = body as { email?: string; role?: string };
  if (!admin.isGlobalAdmin && !admin.orgId) {
    log.finish(403, "not_admin", { user_id: callerId });
    return { error: errorResponse("Solo administradores pueden invitar usuarios", 403, cors) };
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    log.finish(400, "validation_failed", { user_id: callerId });
    return { error: errorResponse("Correo no válido", 400, cors) };
  }
  if (!role || !(VALID_ROLES as readonly string[]).includes(role)) {
    log.finish(400, "invalid_role", { user_id: callerId, payload: { role } });
    return { error: errorResponse(`Rol no soportado: ${role ?? "(vacío)"}`, 400, cors) };
  }
  if (!admin.isGlobalAdmin && !ASSIGNABLE_BY_ORG_ADMIN.has(role)) {
    log.finish(403, "role_not_assignable_by_org_admin", { user_id: callerId, payload: { role } });
    return { error: errorResponse("No tienes permiso para asignar ese rol", 403, cors) };
  }
  return { email, role };
}

export async function handleInvite(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { cors, log, callerId, adminClient, body } = ctx;
  const validacion = validarInvitacion(ctx, admin);
  if ("error" in validacion) return validacion.error;
  const { email, role } = validacion;
  const { organization_id: orgIdPayload, redirect_to: redirectTo } = body as {
    organization_id?: string; redirect_to?: string;
  };

  const targetOrgId = await resolverOrg(adminClient, admin, orgIdPayload);

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo,
      // Evita que el trigger de signup cree una organización fantasma.
      data: { skip_auto_org: true },
    },
  );
  if (inviteError || !invited?.user) {
    const dup = /already|registered|exists|duplicate/i.test(inviteError?.message ?? "");
    const status = dup ? 409 : 400;
    log.finish(status, dup ? "duplicate_email" : "invite_failed", {
      user_id: callerId,
      organization_id: targetOrgId,
      payload: { error: inviteError?.message },
    });
    return errorResponse(
      dup ? `Ya existe una cuenta con el correo ${email}.` : (inviteError?.message ?? "No se pudo invitar"),
      status,
      cors,
    );
  }

  await adminClient.from("user_roles").update({ role }).eq("user_id", invited.user.id);
  if (targetOrgId) {
    const { error: memberError } = await adminClient.from("organization_members").insert({
      user_id: invited.user.id, organization_id: targetOrgId, role,
    });
    if (memberError) {
      await adminClient.auth.admin.deleteUser(invited.user.id);
      log.finish(400, "member_insert_failed", {
        user_id: callerId, organization_id: targetOrgId, payload: { error: memberError.message },
      });
      return errorResponse(memberError.message, 400, cors);
    }
  }

  log.finish(200, "user_invited", {
    user_id: callerId,
    organization_id: targetOrgId,
    payload: { new_user_id: invited.user.id, role },
  });
  return jsonResponse({ user: { id: invited.user.id, email: invited.user.email } }, 200, cors);
}

export async function handleResetPassword(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { cors, log, callerId, adminClient, body } = ctx;
  if (!admin.isGlobalAdmin && !admin.orgId) {
    log.finish(403, "not_admin", { user_id: callerId });
    return errorResponse("Solo administradores pueden enviar restablecimientos", 403, cors);
  }
  const { user_id: userId, redirect_to: redirectTo } = body as {
    user_id?: string; redirect_to?: string;
  };
  if (!userId) {
    log.finish(400, "validation_failed", { user_id: callerId });
    return errorResponse("user_id es requerido", 400, cors);
  }

  const { data: target, error: getErr } = await adminClient.auth.admin.getUserById(userId);
  if (getErr || !target?.user?.email) {
    log.finish(404, "user_not_found", { user_id: callerId, payload: { target: userId } });
    return errorResponse("Usuario no encontrado", 404, cors);
  }

  // Un admin_org sólo puede actuar sobre miembros de su organización.
  if (!admin.isGlobalAdmin) {
    const { data: membresia } = await adminClient
      .from("organization_members")
      .select("user_id")
      .eq("user_id", userId)
      .eq("organization_id", admin.orgId!)
      .maybeSingle();
    if (!membresia) {
      log.finish(403, "cross_org_denied", { user_id: callerId, payload: { target: userId } });
      return errorResponse("El usuario no pertenece a tu organización", 403, cors);
    }
  }

  const { error: resetErr } = await anonClient().auth.resetPasswordForEmail(
    target.user.email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (resetErr) {
    log.finish(400, "reset_failed", { user_id: callerId, payload: { error: resetErr.message } });
    return errorResponse(resetErr.message, 400, cors);
  }

  log.finish(200, "reset_password_sent", { user_id: callerId, payload: { target: userId } });
  return jsonResponse({ ok: true }, 200, cors);
}
