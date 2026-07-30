import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/appRole";
import { UNRESOLVED_EMAIL } from "./constants";
import { logger } from "@/lib/observability/logger";

// Re-export para no romper callers históricos que importan desde el barrel.
export { UNRESOLVED_EMAIL };

/** Estado de la cuenta dentro de la organización (Q-05b). */
export type EstadoInvitacion = "activo" | "pendiente" | "desconocido";

export interface UserRow {
  user_id: string;
  email: string;
  role: AppRole;
  created_at: string;
  /** "pendiente" = invitado pero nunca inició sesión / sin confirmar correo. */
  estado: EstadoInvitacion;
}

interface OrgMemberRow {
  user_id: string;
  role: string;
  created_at: string | null;
}

interface ListUsersRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
}

/** Deriva el estado de invitación a partir de las señales de auth. */
function derivarEstado(row: ListUsersRow | undefined): EstadoInvitacion {
  if (!row) return "desconocido";
  if (row.last_sign_in_at) return "activo";
  if (row.email_confirmed_at) return "activo";
  return "pendiente";
}

/**
 * Indica si la última llamada a `user-management` (action: "list") falló por
 * red/edge. Sirve para NO reportar a Sentry los correos sin resolver cuando la
 * causa es un fallo de conectividad y no un bug de datos.
 */
let ultimoListadoFallo = false;

export function fallóDirectorioUsuarios(): boolean {
  return ultimoListadoFallo;
}

/**
 * Lista los miembros de la organización combinando organization_members
 * con la edge function `user-management` (action: "list") para resolver
 * emails y created_at de auth.
 */
export async function fetchUsuariosOrganizacion(): Promise<UserRow[]> {
  const { data: membersData, error: membersError } = await supabase
    .from("organization_members")
    .select("user_id, role, created_at")
    .order("created_at", { ascending: false });

  if (membersError) throw membersError;
  const members = (membersData ?? []) as OrgMemberRow[];

  const authMap: Record<string, ListUsersRow> = {};
  ultimoListadoFallo = false;
  try {
    const { data: usersData, error: fnError } = await supabase.functions.invoke("user-management", {
      body: { action: "list" },
    });
    if (fnError) {
      ultimoListadoFallo = true;
      logger.warn("fetchUsuariosOrganizacion", "user-management invoke error:", fnError);
    } else if (Array.isArray(usersData)) {
      (usersData as ListUsersRow[]).forEach((u) => {
        authMap[u.id] = u;
      });
    }
  } catch (err) {
    // Mantenemos la tabla funcional con placeholder UNRESOLVED_EMAIL; logueamos para debug en prod.
    ultimoListadoFallo = true;
    logger.warn("fetchUsuariosOrganizacion", "user-management threw:", err);
  }

  return members.map((m) => ({
    user_id: m.user_id,
    email: authMap[m.user_id]?.email || UNRESOLVED_EMAIL,
    role: m.role as AppRole,
    created_at: authMap[m.user_id]?.created_at || m.created_at || "",
    estado: derivarEstado(authMap[m.user_id]),
  }));
}


// UNRESOLVED_EMAIL vive en `./constants.ts` (extraído en Sprint 2 · ítem 4b
// para romper el ciclo `portales.ts → ./index → portales.ts`).

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

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

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

/**
 * Alta de usuario (Q-05, v13.339.0).
 *
 * Correcciones respecto de la versión previa:
 * - La organización destino se manda SIEMPRE a la edge function (`organization_id`),
 *   que es quien inserta la membresía con el `app_role` exacto. Antes el cliente
 *   hacía un insert paralelo casteando el rol a "admin"|"operador"|"viewer",
 *   perdiendo los roles modernos (tesorero, coordinador_logistico, …).
 * - Valida email duplicado antes de invocar.
 * - Re-verifica la membresía después del alta: si no existe, lanza error (nada
 *   de toast verde fantasma).
 */
export async function createUserViaEdgeFunction(
  params: CreateUserParams,
): Promise<CreateUserResponse> {
  const emailNormalizado = params.email.trim().toLowerCase();

  // 1) Duplicado en cliente: evita el viaje al servidor y da mensaje claro.
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

  // 2) Verificación post-alta: la membresía debe existir.
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
