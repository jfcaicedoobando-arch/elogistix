/**
 * Portal de Brokers (vendedores externos): alta por invitación y listado.
 * Un broker puede trabajar con varias organizaciones; cada una guarda su
 * propio renglón en `crm_brokers` con su % de comisión.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.119.0";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import type { HandlerCtx, AdminAccess } from "./handlers.ts";
import { resolveRedirectTo } from "./clientHandlers.ts";
import { mensajeSeguro } from "./errores.ts";
import { validarAltaBroker } from "./brokerValidacion.ts";

const LC_BROKER_CUENTA_NO_REINVITABLE =
  "LC_BROKER_CUENTA_NO_REINVITABLE: Ese correo ya tiene una cuenta que no es de broker. Usa otro correo.";

/** Una cuenta existente sólo se reutiliza si es exclusivamente de broker. */
async function cuentaExistente(
  adminClient: SupabaseClient,
  email: string,
): Promise<{ userId: string | null; bloqueada: boolean }> {
  const { data: u } = await adminClient
    .schema("auth").from("users").select("id").ilike("email", email).maybeSingle();
  const userId = (u as { id?: string } | null)?.id ?? null;
  if (!userId) return { userId: null, bloqueada: false };
  const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", userId);
  const lista = ((roles ?? []) as { role: string }[]).map((r) => r.role);
  const { data: miembros } = await adminClient
    .from("organization_members").select("organization_id").eq("user_id", userId).limit(1);
  const bloqueada = lista.some((r) => r !== "broker") || (miembros ?? []).length > 0;
  return { userId, bloqueada };
}

async function invitarNuevo(
  adminClient: SupabaseClient,
  email: string,
  nombre: string,
  redirectTo: string,
): Promise<{ userId: string } | { error: string }> {
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    // skip_auto_org evita crear una organización fantasma para el broker.
    data: { role: "broker", skip_auto_org: true, full_name: nombre },
  });
  if (error || !data.user) return { error: error?.message ?? "Error desconocido al invitar" };
  return { userId: data.user.id };
}

async function asegurarRolBroker(adminClient: SupabaseClient, userId: string): Promise<void> {
  const { data: existing } = await adminClient
    .from("user_roles").select("id").eq("user_id", userId).maybeSingle();
  if (!existing) {
    await adminClient.from("user_roles").insert({ user_id: userId, role: "broker" });
  } else {
    await adminClient.from("user_roles").update({ role: "broker" }).eq("user_id", userId);
  }
}

export async function handleInviteBroker(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { req, cors, log, callerId, adminClient, body } = ctx;
  const input = validarAltaBroker(body);
  if (typeof input === "string") {
    log.finish(400, "invalid_broker", { user_id: callerId });
    return errorResponse(input, 400, cors);
  }
  const { email, nombre, comision_pct, organization_id } = input;
  if (!admin.isGlobalAdmin && admin.orgId !== organization_id) {
    log.finish(403, "cross_org_broker_blocked", { user_id: callerId });
    return errorResponse("No autorizado para crear brokers en esa organización", 403, cors);
  }

  const { data: dup } = await adminClient
    .from("crm_brokers").select("id").eq("organization_id", organization_id).ilike("email", email).maybeSingle();
  if (dup) {
    log.finish(409, "broker_duplicado", { organization_id });
    return errorResponse("LC_BROKER_DUPLICADO: Ese correo ya está dado de alta como broker.", 409, cors);
  }

  const previa = await cuentaExistente(adminClient, email);
  if (previa.bloqueada) {
    log.finish(409, "cuenta_no_reinvitable", { organization_id });
    return errorResponse(LC_BROKER_CUENTA_NO_REINVITABLE, 409, cors);
  }

  let userId = previa.userId;
  if (!userId) {
    const r = await invitarNuevo(adminClient, email, nombre, resolveRedirectTo(req.headers.get("origin") ?? ""));
    if ("error" in r) {
      log.finish(500, "invite_email_failed", { organization_id, payload: { error: r.error } });
      return errorResponse(mensajeSeguro(r.error, "Error al invitar al broker. Intenta de nuevo."), 500, cors);
    }
    userId = r.userId;
  }
  await asegurarRolBroker(adminClient, userId);

  const { data: fila, error } = await adminClient
    .from("crm_brokers")
    .insert({ organization_id, user_id: userId, nombre, email, comision_pct, created_by: callerId })
    .select("id").single();
  if (error) {
    log.finish(500, "broker_insert_failed", { organization_id, payload: { error: error.message } });
    return errorResponse(mensajeSeguro(error.message, "No se pudo registrar al broker."), 500, cors);
  }

  await adminClient.from("bitacora_actividad").insert({
    organization_id, usuario_id: callerId, usuario_email: "", modulo: "usuarios",
    accion: "Broker: alta e invitación", entidad_id: (fila as { id: string }).id,
    entidad_nombre: email, detalles: { comision_pct, cuenta_nueva: !previa.userId },
  });
  log.finish(200, "broker_invited", { organization_id, payload: { user_id: userId } });
  return jsonResponse({ success: true, broker_id: (fila as { id: string }).id, is_new: !previa.userId }, 200, cors);
}
