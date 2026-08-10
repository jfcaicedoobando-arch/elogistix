/**
 * Mutaciones de usuarios (cambio de rol y bajas) vía edge function
 * `user-management`. El alta vive en `./mutaciones.alta.ts` y los helpers de
 * sesión en `./mutaciones.auth.ts` (límite de 200 líneas, Power of 10).
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/appRole";
import { registrarActividad } from "@/services/bitacora/registrar";
import { getAuthToken, resetRedirectUrl } from "./mutaciones.auth";

export {
  createUserViaEdgeFunction,
  type CreateUserParams,
} from "./mutaciones.alta";

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
