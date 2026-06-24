/**
 * Listados de usuarios vinculados a portales externos (Cliente / Agente).
 *
 * v13.135.23 — agregado en respuesta a que los agentes invitados al Portal
 * Agente no aparecían en `/usuarios` (esa página sólo lee
 * `organization_members`). Aquí leemos `client_users` / `agente_users` y
 * resolvemos el email vía la edge `user-management` action `list`.
 */
import { supabase } from "@/integrations/supabase/client";
import { UNRESOLVED_EMAIL } from "./index";

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

interface ListUsersRow {
  id: string;
  email: string;
  created_at: string;
}

async function fetchEmailMap(): Promise<Record<string, string>> {
  const emailMap: Record<string, string> = {};
  try {
    const { data, error } = await supabase.functions.invoke("user-management", {
      body: { action: "list" },
    });
    if (error) {
      console.warn("[portales] user-management invoke error:", error);
      return emailMap;
    }
    if (Array.isArray(data)) {
      (data as ListUsersRow[]).forEach((u) => {
        emailMap[u.id] = u.email;
      });
    }
  } catch (err) {
    console.warn("[portales] user-management threw:", err);
  }
  return emailMap;
}

export async function fetchUsuariosPortalCliente(): Promise<PortalClienteUserRow[]> {
  const { data, error } = await supabase
    .from("client_users")
    .select("id, user_id, cliente_id, created_at, clientes:cliente_id(nombre)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const emailMap = await fetchEmailMap();
  type Row = {
    id: string;
    user_id: string;
    cliente_id: string;
    created_at: string | null;
    clientes: { nombre: string | null } | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
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
  const emailMap = await fetchEmailMap();
  type Row = {
    id: string;
    user_id: string;
    agente_id: string;
    created_at: string;
    costeo_agentes: { nombre: string | null } | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    agente_id: r.agente_id,
    agente_nombre: r.costeo_agentes?.nombre ?? "—",
    email: emailMap[r.user_id] ?? UNRESOLVED_EMAIL,
    created_at: r.created_at ?? "",
  }));
}
