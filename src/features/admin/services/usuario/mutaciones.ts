/**
 * Mutaciones de usuarios (alta, cambio de rol y baja) vía edge function
 * `user-management`. Extraído de `./index.ts` para mantener los archivos
 * bajo el límite de 200 líneas (Power of 10).
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/appRole";
import { fallóDirectorioUsuarios, fetchUsuariosOrganizacion } from "./listado";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface CreateUserParams {
  email: string;
  /** U-04: vacío ⇒ se envía invitación por correo (sin contraseña temporal). */
  password?: string;
  role: string;
  orgId?: string;
}

export interface CreateUserResponse {
  user?: { id: string };
  error?: string;
  [key: string]: unknown;
}

/** URL de retorno para invitaciones/restablecimientos (segura en entorno node). */
function resetRedirectUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/reset-password`;
}

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

/**
 * Cambia el rol de un usuario dentro de UNA organización.
 *
 * U-02 (auditoría 2026-07-30): el filtro incluye `organization_id` para que un
 * usuario con membresía en varias organizaciones no vea alterado su rol en
 * todas al editarlo en una sola.
 */
export async function updateUserRole(
  userId: string,
  newRole: AppRole,
  organizationId?: string | null,
): Promise<void> {
  let query = supabase.from("organization_members").update({ role: newRole }).eq("user_id", userId);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteUserViaEdgeFunction(userId: string): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("user-management", {
    body: { action: "delete", user_id: userId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  await registrarActividad({
    modulo: "usuarios",
    accion: "Eliminó usuario",
    entidadId: userId,
  });
  return data;
}

export async function deleteUserViaEdgeFunctionAuth(userId: string): Promise<unknown> {
  const token = await getAuthToken();
  const res = await supabase.functions.invoke("user-management", {
    body: { action: "delete", user_id: userId },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (res.error) throw new Error(res.error.message || "Error al eliminar usuario");
  const body = res.data as { error?: string };
  if (body?.error) throw new Error(body.error);
  return body;
}

/**
 * Alta de usuario (Q-05, v13.339.0).
 *
 * - La organización destino se manda SIEMPRE a la edge function
 *   (`organization_id`), que inserta la membresía con el `app_role` exacto.
 * - Valida email duplicado antes de invocar.
 * - Re-verifica la membresía después del alta: si no existe, lanza error.
 */
export async function createUserViaEdgeFunction(
  params: CreateUserParams,
): Promise<CreateUserResponse> {
  const emailNormalizado = params.email.trim().toLowerCase();

  // Ola 4 · N13: la validación de duplicados ya NO es fail-open. Sin org no
  // hay universo contra el cual comparar (el listado es fail-closed desde
  // Ola 3 · P2) y con el directorio de auth caído los correos son
  // placeholders UNRESOLVED_EMAIL: en ambos casos se aborta el alta en lugar
  // de invitar a ciegas.
  if (!params.orgId) {
    throw new Error("No se pudo resolver la organización destino del alta. Reintenta o selecciona una organización.");
  }
  const existentes = await fetchUsuariosOrganizacion(params.orgId);
  if (fallóDirectorioUsuarios()) {
    throw new Error("No se pudo verificar el directorio de usuarios; reintenta en unos segundos.");
  }
  if (existentes.some((u) => u.email.toLowerCase() === emailNormalizado)) {
    throw new Error(`Ya existe un usuario con el correo ${emailNormalizado} en esta organización.`);
  }

  const token = await getAuthToken();
  const res = await supabase.functions.invoke("user-management", {
    body: {
      action: params.password ? "create" : "invite",
      email: emailNormalizado,
      password: params.password,
      role: params.role,
      organization_id: params.orgId,
      redirect_to: resetRedirectUrl(),
    },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (res.error) throw new Error(res.error.message || "Error al crear usuario");
  const body = res.data as CreateUserResponse;
  if (body?.error) throw new Error(body.error);

  const nuevoId = body?.user?.id;
  if (!nuevoId) {
    throw new Error("No se pudo completar el alta: el servicio de identidad no devolvió el usuario.");
  }

  let verify = supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("user_id", nuevoId);
  if (params.orgId) verify = verify.eq("organization_id", params.orgId);
  const { data: membresia, error: verifyError } = await verify.maybeSingle();

  if (verifyError || !membresia) {
    throw new Error(
      "No se pudo completar el alta: el usuario no quedó asignado a la organización. Reintenta o contacta soporte.",
    );
  }

  await registrarActividad({
    modulo: "usuarios",
    accion: "Creó usuario",
    entidadId: nuevoId,
    entidadNombre: emailNormalizado,
    detalles: { role: params.role, orgId: params.orgId ?? null },
  });

  return body;
}

/** U-03: quita la membresía del usuario sin borrar su cuenta ni su historial. */
export async function quitarDeOrganizacion(
  userId: string,
  organizationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("user_id", userId)
    .eq("organization_id", organizationId);
  if (error) throw error;
  await registrarActividad({
    modulo: "usuarios",
    accion: "Quitó usuario de organización",
    entidadId: userId,
    detalles: { organizationId },
  });
}

/** U-03: dispara el correo de restablecimiento de contraseña para el usuario. */
export async function enviarResetPassword(userId: string): Promise<void> {
  const token = await getAuthToken();
  const res = await supabase.functions.invoke("user-management", {
    body: {
      action: "reset-password",
      user_id: userId,
      redirect_to: resetRedirectUrl(),
    },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (res.error) throw new Error(res.error.message || "Error al enviar el correo");
  const body = res.data as { error?: string };
  if (body?.error) throw new Error(body.error);
  await registrarActividad({
    modulo: "usuarios",
    accion: "Envió correo de restablecimiento de contraseña",
    entidadId: userId,
  });
}
