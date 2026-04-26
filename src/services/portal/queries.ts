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

export async function fetchPortalCotizaciones(clienteIds: string[]) {
  if (!clienteIds.length) return [];
  const { data, error } = await supabase
    .from("cotizaciones")
    .select(PORTAL_COTIZACION_LIST_COLUMNS)
    .in("cliente_id", clienteIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPortalCotizacion(id: string) {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select(
      "id, folio, cliente_id, cliente_nombre, modo, tipo, incoterm, descripcion_mercancia, descripcion_adicional, peso_kg, volumen_m3, piezas, origen, destino, conceptos_venta, subtotal, moneda, vigencia_dias, fecha_vigencia, notas, estado, tipo_carga, tipo_embarque, tipo_contenedor, tipo_peso, sector_economico, tiempo_transito_dias, dias_libres_destino, dias_almacenaje, frecuencia, ruta_texto, validez_propuesta, tipo_movimiento, seguro, valor_seguro_usd, carta_garantia, num_contenedores, dimensiones_lcl, dimensiones_aereas, msds_archivo, created_at",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
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
  const { data, error } = await supabase
    .from("client_users")
    .select("id, user_id, cliente_id, created_at");
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
