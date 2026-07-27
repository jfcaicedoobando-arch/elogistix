/**
 * Listados de usuarios vinculados a portales externos (Cliente / Agente).
 *
 * v13.135.23 — agregado en respuesta a que los agentes invitados al Portal
 * Agente no aparecían en `/usuarios` (esa página sólo lee
 * `organization_members`). Aquí leemos `client_users` / `agente_users` y
 * resolvemos el email vía la edge `user-management` action `list`.
 */
import { supabase } from "@/integrations/supabase/client";
import { UNRESOLVED_EMAIL } from "./constants";
import { logger } from "@/lib/observability/logger";

export interface PortalClienteUserRow {
  id: string;
  user_id: string;
  cliente_id: string;
  cliente_nombre: string;
  email: string;
  created_at: string;
}

export interface PortalAgenteUserRow {
  id: string;
  user_id: string;
  agente_id: string;
  agente_nombre: string;
  email: string;
  created_at: string;
}


/**
 * v13.135.24 — Resuelve emails de portales vía la acción dedicada
 * `list-portal-emails`. Antes usábamos `list`, que sólo devuelve miembros
 * de la organización, dejando vacíos los emails de portal cliente/agente.
 */
async function fetchPortalEmailMap(userIds: string[]): Promise<Record<string, string>> {
  const emailMap: Record<string, string> = {};
  if (userIds.length === 0) return emailMap;
  try {
    const { data, error } = await supabase.functions.invoke("user-management", {
      body: { action: "list-portal-emails", user_ids: userIds },
    });
    if (error) {
      logger.warn("portales", "list-portal-emails invoke error:", error);
      return emailMap;
    }
    if (Array.isArray(data)) {
      (data as Array<{ id: string; email: string }>).forEach((u) => {
        emailMap[u.id] = u.email;
      });
    }
  } catch (err) {
    logger.warn("portales", "list-portal-emails threw:", err);
  }
  return emailMap;
}




export async function fetchUsuariosPortalCliente(): Promise<PortalClienteUserRow[]> {
  const { data, error } = await supabase
    .from("client_users")
    .select("id, user_id, cliente_id, created_at, clientes:cliente_id(nombre)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = {
    id: string;
    user_id: string;
    cliente_id: string;
    created_at: string | null;
    clientes: { nombre: string | null } | null;
  };
  const rows = (data ?? []) as Row[];
  const emailMap = await fetchPortalEmailMap(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    cliente_id: r.cliente_id,
    cliente_nombre: r.clientes?.nombre ?? "—",
    email: emailMap[r.user_id] ?? UNRESOLVED_EMAIL,
    created_at: r.created_at ?? "",
  }));
}

export async function fetchUsuariosPortalAgente(): Promise<PortalAgenteUserRow[]> {
  const { data, error } = await supabase
    .from("agente_users")
    .select("id, user_id, agente_id, created_at, costeo_agentes:agente_id(nombre)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = {
    id: string;
    user_id: string;
    agente_id: string;
    created_at: string;
    costeo_agentes: { nombre: string | null } | null;
  };
  const rows = (data ?? []) as Row[];
  const emailMap = await fetchPortalEmailMap(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    agente_id: r.agente_id,
    agente_nombre: r.costeo_agentes?.nombre ?? "—",
    email: emailMap[r.user_id] ?? UNRESOLVED_EMAIL,
    created_at: r.created_at ?? "",
  }));
}
