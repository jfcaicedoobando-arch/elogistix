/**
 * Mutaciones de usuarios (alta, cambio de rol y baja) vía edge function
 * `user-management`. Extraído de `./index.ts` para mantener los archivos
 * bajo el límite de 200 líneas (Power of 10).
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/appRole";
import { fetchUsuariosOrganizacion, type UserRow } from "./listado";

export interface CreateUserParams {
  email: string;
  password: string;
  role: string;
  orgId?: string;
}

export interface CreateUserResponse {
  user?: { id: string };
  error?: string;
  [key: string]: unknown;
}

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

export async function updateUserRole(userId: string, newRole: AppRole): Promise<void> {
  const { error } = await supabase
    .from("organization_members")
    .update({ role: newRole })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteUserViaEdgeFunction(userId: string): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("user-management", {
    body: { action: "delete", user_id: userId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
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

  const existentes = await fetchUsuariosOrganizacion().catch(() => [] as UserRow[]);
  if (existentes.some((u) => u.email.toLowerCase() === emailNormalizado)) {
    throw new Error(`Ya existe un usuario con el correo ${emailNormalizado} en esta organización.`);
  }

  const token = await getAuthToken();
  const res = await supabase.functions.invoke("user-management", {
    body: {
      action: "create",
      email: emailNormalizado,
      password: params.password,
      role: params.role,
      organization_id: params.orgId,
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

  const { data: membresia, error: verifyError } = await supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("user_id", nuevoId)
    .maybeSingle();

  if (verifyError || !membresia) {
    throw new Error(
      "No se pudo completar el alta: el usuario no quedó asignado a la organización. Reintenta o contacta soporte.",
    );
  }

  return body;
}
