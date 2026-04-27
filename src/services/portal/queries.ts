import { supabase } from "@/integrations/supabase/client";
import {
  PORTAL_EMBARQUE_LIST_COLUMNS,
  PORTAL_EMBARQUE_DETAIL_COLUMNS,
  PORTAL_EVENTO_COLUMNS,
  PORTAL_DOCUMENTO_COLUMNS,
  PORTAL_COTIZACION_LIST_COLUMNS,
  PORTAL_FACTURA_LIST_COLUMNS,
} from "./columns";

export async function fetchPortalEmbarques(clienteIds: string[]) {
  if (!clienteIds.length) return [];
  const { data, error } = await supabase
    .from("embarques")
    .select(PORTAL_EMBARQUE_LIST_COLUMNS)
    .in("cliente_id", clienteIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPortalEmbarque(id: string) {
  const { data, error } = await supabase
    .from("embarques")
    .select(PORTAL_EMBARQUE_DETAIL_COLUMNS)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchPortalEventos(embarqueId: string) {
  const { data, error } = await supabase
    .from("eventos_embarque")
    .select(PORTAL_EVENTO_COLUMNS)
    .eq("embarque_id", embarqueId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPortalDocumentos(embarqueId: string) {
  const { data, error } = await supabase
    .from("documentos_embarque")
    .select(PORTAL_DOCUMENTO_COLUMNS)
    .eq("embarque_id", embarqueId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Estados visibles para clientes en el portal.
// Borrador, Vencida y Cancelada se ocultan: son trabajo interno o ruido sin valor para el cliente.
// Esta lista debe mantenerse alineada con la política RLS "Cliente read own cotizaciones".
const PORTAL_COTIZACION_ESTADOS_VISIBLES = [
  "Enviada",
  "Aceptada",
  "Rechazada",
  "En operación",
] as const;

export async function fetchPortalCotizaciones(clienteIds: string[]) {
  if (!clienteIds.length) return [];
  const { data, error } = await supabase
    .from("cotizaciones")
    .select(PORTAL_COTIZACION_LIST_COLUMNS)
    .in("cliente_id", clienteIds)
    .in("estado", PORTAL_COTIZACION_ESTADOS_VISIBLES)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const cotizaciones = data ?? [];

  // Resolver expediente del embarque vinculado (cuando exista) en una segunda query batch.
  const embarqueIds = cotizaciones
    .map((c) => c.embarque_id)
    .filter((id): id is string => Boolean(id));
  if (embarqueIds.length === 0) {
    return cotizaciones.map((c) => ({ ...c, embarque_expediente: null as string | null }));
  }
  const { data: embs, error: errEmb } = await supabase
    .from("embarques")
    .select("id, expediente")
    .in("id", embarqueIds);
  if (errEmb) throw errEmb;
  const expById = new Map((embs ?? []).map((e) => [e.id, e.expediente]));
  return cotizaciones.map((c) => ({
    ...c,
    embarque_expediente: c.embarque_id ? expById.get(c.embarque_id) ?? null : null,
  }));
}

export async function fetchPortalCotizacion(id: string) {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  if (!data) return data;

  let embarque_expediente: string | null = null;
  if (data.embarque_id) {
    const { data: emb } = await supabase
      .from("embarques")
      .select("expediente")
      .eq("id", data.embarque_id)
      .maybeSingle();
    embarque_expediente = emb?.expediente ?? null;
  }
  return { ...data, embarque_expediente };
}

export async function fetchPortalFacturas(clienteIds: string[]) {
  if (!clienteIds.length) return [];
  const { data, error } = await supabase
    .from("facturas")
    .select(PORTAL_FACTURA_LIST_COLUMNS)
    .in("cliente_id", clienteIds)
    .order("fecha_emision", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPortalClientUsers() {
  const { data, error } = await supabase.from("client_users").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function fetchPortalClienteName(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("client_users")
    .select("cliente_id, clientes(nombre)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const clientes = data?.clientes as unknown as { nombre: string } | null;
  return clientes?.nombre ?? null;
}

export async function fetchPortalOrgName(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("client_users")
    .select("organizations(nombre)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const org = data?.organizations as unknown as { nombre: string } | null;
  return org?.nombre ?? null;
}
