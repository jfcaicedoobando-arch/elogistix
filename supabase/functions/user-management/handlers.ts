/**
 * Handlers por acción de la función consolidada `user-management`.
 * Cada handler conserva la lógica de autorización y validación de las
 * funciones originales (create-user, delete-user, list-users,
 * invite-client-user, list-client-users) sin cambios de comportamiento.
 */
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

export interface HandlerCtx {
  req: Request;
  cors: Record<string, string>;
  log: { finish: (status: number, event: string, meta?: Record<string, unknown>) => void };
  callerId: string;
  adminClient: SupabaseClient;
  body: Record<string, unknown>;
}

export interface AdminAccess {
  isGlobalAdmin: boolean;
  orgId: string | null;
}

// ───────────────────────────────────────────────────────────── create ──
const VALID_ROLES = ["admin", "operador", "viewer"] as const;

export function validateCreatePayload(body: { email?: string; password?: string }): string | null {
  if (!body.email || !body.password) return "Email y contraseña son requeridos";
  if (body.password.length < 6) return "La contraseña debe tener al menos 6 caracteres";
  return null;
}

export async function handleCreate(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { cors, log, callerId, adminClient, body } = ctx;
  if (!admin.isGlobalAdmin && !admin.orgId) {
    log.finish(403, "not_admin", { user_id: callerId });
    return errorResponse("Solo administradores pueden crear usuarios", 403, cors);
  }
  const validationError = validateCreatePayload(body as { email?: string; password?: string });
  if (validationError) {
    log.finish(400, "validation_failed", { user_id: callerId });
    return errorResponse(validationError, 400, cors);
  }
  const { email, password, role } = body as { email: string; password: string; role?: string };
  const selectedRole = (VALID_ROLES as readonly string[]).includes(role ?? "")
    ? (role as string)
    : "viewer";

  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createError) {
    log.finish(400, "auth_create_failed", {
      user_id: callerId,
      organization_id: admin.orgId ?? null,
      payload: { error: createError.message },
    });
    return errorResponse(createError.message, 400, cors);
  }

  if (selectedRole !== "viewer") {
    await adminClient.from("user_roles").update({ role: selectedRole }).eq("user_id", newUser.user.id);
  }
  if (admin.orgId) {
    await adminClient.from("organization_members").insert({
      user_id: newUser.user.id,
      organization_id: admin.orgId,
      role: selectedRole,
    });
  }

  log.finish(200, "user_created", {
    user_id: callerId,
    organization_id: admin.orgId ?? null,
    payload: { new_user_id: newUser.user.id, role: selectedRole },
  });
  return jsonResponse({ user: { id: newUser.user.id, email: newUser.user.email } }, 200, cors);
}

// ───────────────────────────────────────────────────────────── delete ──
export async function handleDelete(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { cors, log, callerId, adminClient, body } = ctx;
  if (!admin.isGlobalAdmin && !admin.orgId) {
    log.finish(403, "not_admin", { user_id: callerId });
    return errorResponse("Solo administradores pueden eliminar usuarios", 403, cors);
  }
  const user_id = typeof body.user_id === "string" ? body.user_id : "";
  if (!user_id) {
    log.finish(400, "missing_user_id", { user_id: callerId });
    return errorResponse("user_id es requerido", 400, cors);
  }
  if (user_id === callerId) {
    log.finish(400, "self_delete_blocked", { user_id: callerId });
    return errorResponse("No puedes eliminar tu propia cuenta", 400, cors);
  }

  if (!admin.isGlobalAdmin && admin.orgId) {
    const { data: targetMember } = await adminClient
      .from("organization_members")
      .select("id")
      .eq("user_id", user_id)
      .eq("organization_id", admin.orgId)
      .maybeSingle();
    if (!targetMember) {
      log.finish(403, "cross_org_delete_blocked", {
        user_id: callerId,
        organization_id: admin.orgId,
        payload: { target_user_id: user_id },
      });
      return errorResponse("El usuario no pertenece a tu organización", 403, cors);
    }
    const { data: targetRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id);
    const targetIsSuperAdmin = (targetRoles ?? []).some((r: { role: string }) => r.role === "super_admin");
    if (targetIsSuperAdmin) {
      log.finish(403, "privesc_blocked_super_admin", {
        user_id: callerId,
        organization_id: admin.orgId,
        payload: { target_user_id: user_id },
      });
      return errorResponse("No tienes permiso para eliminar a un super administrador", 403, cors);
    }
  }

  await adminClient.from("organization_members").delete().eq("user_id", user_id);
  await adminClient.from("user_roles").delete().eq("user_id", user_id);

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
  if (deleteError) {
    log.finish(400, "auth_delete_failed", {
      user_id: callerId,
      payload: { target_user_id: user_id, error: deleteError.message },
    });
    return errorResponse(deleteError.message, 400, cors);
  }

  log.finish(200, "user_deleted", {
    user_id: callerId,
    organization_id: admin.orgId ?? null,
    payload: { target_user_id: user_id },
  });
  return jsonResponse({ success: true }, 200, cors);
}

// ────────────────────────────────────────────────────────────── list ──
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

// ───────────────────────────────────────────────────── invite-client ──
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

export async function handleInviteClient(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { req, cors, log, callerId, adminClient, body } = ctx;
  if (!admin.isGlobalAdmin && !admin.orgId) {
    log.finish(403, "not_admin", { user_id: callerId });
    return errorResponse("Solo administradores", 403, cors);
  }
  const email = typeof body.email === "string" ? body.email : "";
  const cliente_id = typeof body.cliente_id === "string" ? body.cliente_id : "";
  const organization_id = typeof body.organization_id === "string" ? body.organization_id : "";
  if (!email || !cliente_id || !organization_id) {
    log.finish(400, "missing_fields", { user_id: callerId });
    return errorResponse("Faltan campos requeridos: email, cliente_id, organization_id", 400, cors);
  }

  if (!admin.isGlobalAdmin && admin.orgId !== organization_id) {
    log.finish(403, "cross_org_invite_blocked", {
      user_id: callerId, organization_id: admin.orgId, payload: { target_org: organization_id },
    });
    return errorResponse("No autorizado para invitar usuarios a esa organización", 403, cors);
  }

  const { data: cliente } = await adminClient
    .from("clientes")
    .select("id, organization_id")
    .eq("id", cliente_id)
    .maybeSingle();
  if (!cliente || (cliente as { organization_id: string }).organization_id !== organization_id) {
    log.finish(400, "invalid_cliente", { user_id: callerId, organization_id, payload: { cliente_id } });
    return errorResponse("Cliente inválido para esa organización", 400, cors);
  }

  const redirectTo = resolveRedirectTo(req.headers.get("origin") ?? "");

  const { data: existing } = await adminClient
    .schema("auth")
    .from("users")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();

  let userId: string;
  let isNew: boolean;
  if (existing) {
    await adminClient.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    await anon.auth.resetPasswordForEmail(email, { redirectTo });
    userId = (existing as { id: string }).id;
    isNew = false;
  } else {
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { role: "cliente" },
    });
    if (error || !data.user) {
      const msg = error?.message ?? "Error desconocido al invitar";
      log.finish(500, "invite_email_failed", { organization_id, payload: { error: msg } });
      return errorResponse(`Error al invitar usuario: ${msg}`, 500, cors);
    }
    userId = data.user.id;
    isNew = true;
  }

  const { data: existingRole } = await adminClient
    .from("user_roles").select("id").eq("user_id", userId).maybeSingle();
  if (!existingRole) {
    await adminClient.from("user_roles").insert({ user_id: userId, role: "cliente" });
  }

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

// ─────────────────────────────────────────────────────── list-clients ──
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

  const { data: superRole } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "super_admin")
    .maybeSingle();
  let allowed = !!superRole;
  if (!allowed) {
    const { data: member } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("user_id", callerId)
      .eq("organization_id", clienteOrgId)
      .in("role", ["admin", "operador"])
      .maybeSingle();
    allowed = !!member;
  }
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
