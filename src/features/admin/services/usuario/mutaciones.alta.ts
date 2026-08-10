/**
 * Alta de usuarios (crear / invitar) vía edge function `user-management`.
 * Extraído de `./mutaciones.ts` para mantener los archivos bajo el límite de
 * 200 líneas (Power of 10).
 */
import { supabase } from "@/integrations/supabase/client";
import { fallóDirectorioUsuarios, fetchUsuariosOrganizacion } from "./listado";
import { registrarActividad } from "@/services/bitacora/registrar";
import { getAuthToken, resetRedirectUrl } from "./mutaciones.auth";

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

/**
 * Ola 4 · N13: la validación de duplicados ya NO es fail-open. Sin org no hay
 * universo contra el cual comparar (el listado es fail-closed desde Ola 3 · P2)
 * y con el directorio de auth caído los correos son placeholders
 * UNRESOLVED_EMAIL: en ambos casos se aborta el alta en lugar de invitar a
 * ciegas.
 */
async function validarAltaUsuario(orgId: string | undefined, emailNormalizado: string): Promise<void> {
  if (!orgId) {
    throw new Error("No se pudo resolver la organización destino del alta. Reintenta o selecciona una organización.");
  }
  const existentes = await fetchUsuariosOrganizacion(orgId);
  if (fallóDirectorioUsuarios()) {
    throw new Error("No se pudo verificar el directorio de usuarios; reintenta en unos segundos.");
  }
  if (existentes.some((u) => u.email.toLowerCase() === emailNormalizado)) {
    throw new Error(`Ya existe un usuario con el correo ${emailNormalizado} en esta organización.`);
  }
}

/** Re-verifica que la edge function sí insertó la membresía del nuevo usuario. */
async function verificarMembresia(nuevoId: string, orgId?: string): Promise<void> {
  let verify = supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("user_id", nuevoId);
  if (orgId) verify = verify.eq("organization_id", orgId);
  const { data: membresia, error: verifyError } = await verify.maybeSingle();
  if (verifyError || !membresia) {
    throw new Error(
      "No se pudo completar el alta: el usuario no quedó asignado a la organización. Reintenta o contacta soporte.",
    );
  }
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
  await validarAltaUsuario(params.orgId, emailNormalizado);

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

  await verificarMembresia(nuevoId, params.orgId);

  await registrarActividad({
    modulo: "usuarios",
    accion: "Creó usuario",
    entidadId: nuevoId,
    entidadNombre: emailNormalizado,
    detalles: { role: params.role, orgId: params.orgId ?? null },
  });

  return body;
}
