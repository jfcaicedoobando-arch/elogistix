/**
 * Listado de miembros de la organización: combina `organization_members`
 * con la edge function `user-management` (action: "list") para resolver
 * emails y fechas de alta de auth.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/appRole";
import { UNRESOLVED_EMAIL } from "./constants";
import { logger } from "@/lib/observability/logger";

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

async function cargarDirectorioAuth(): Promise<Record<string, ListUsersRow>> {
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
    // Mantenemos la tabla funcional con placeholder UNRESOLVED_EMAIL.
    ultimoListadoFallo = true;
    logger.warn("fetchUsuariosOrganizacion", "user-management threw:", err);
  }
  return authMap;
}

export async function fetchUsuariosOrganizacion(): Promise<UserRow[]> {
  const { data: membersData, error: membersError } = await supabase
    .from("organization_members")
    .select("user_id, role, created_at")
    .order("created_at", { ascending: false });

  if (membersError) throw membersError;
  const members = (membersData ?? []) as OrgMemberRow[];
  const authMap = await cargarDirectorioAuth();

  return members.map((m) => ({
    user_id: m.user_id,
    email: authMap[m.user_id]?.email || UNRESOLVED_EMAIL,
    role: m.role as AppRole,
    created_at: authMap[m.user_id]?.created_at || m.created_at || "",
    estado: derivarEstado(authMap[m.user_id]),
  }));
}
