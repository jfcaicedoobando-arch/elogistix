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
  /** U-01: organización a la que pertenece la membresía. */
  organization_id: string;
  organizacion_nombre: string;
}

interface OrgMemberRow {
  user_id: string;
  role: string;
  created_at: string | null;
  organization_id: string;
  organizations: { nombre: string | null } | null;
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

/**
 * Lista los miembros de una organización.
 *
 * U-01 (auditoría 2026-07-30): `orgId` es obligatorio en la práctica para
 * cualquier usuario que no sea `super_admin`. Si se omite (super_admin viendo
 * todas las organizaciones), cada fila trae `organizacion_nombre` para que la
 * tabla pueda atribuir correctamente el usuario.
 */
export async function fetchUsuariosOrganizacion(orgId?: string | null): Promise<UserRow[]> {
  // Ola 3 · P2 (fail-closed): sin organización activa NO listamos nada. Antes
  // se omitía el filtro y el listado traía usuarios de todas las orgs.
  if (!orgId) throw new Error("LC_ORG_REQUERIDA");
  const query = supabase
    .from("organization_members")
    .select("user_id, role, created_at, organization_id, organizations(nombre)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  const { data: membersData, error: membersError } = await query;

  if (membersError) throw membersError;
  const members = (membersData ?? []) as OrgMemberRow[];
  const authMap = await cargarDirectorioAuth();

  return members.map((m) => ({
    user_id: m.user_id,
    email: authMap[m.user_id]?.email || UNRESOLVED_EMAIL,
    role: m.role as AppRole,
    created_at: authMap[m.user_id]?.created_at || m.created_at || "",
    estado: derivarEstado(authMap[m.user_id]),
    organization_id: m.organization_id,
    organizacion_nombre: m.organizations?.nombre ?? "—",
  }));
}
