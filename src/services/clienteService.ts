import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Cliente = Tables<"clientes">;
export type ContactoCliente = Tables<"contactos_cliente">;

/** Columnas necesarias para la tabla de clientes y reportes */
export const CLIENTE_LIST_COLUMNS =
  "id, nombre, rfc, ciudad, estado, contacto, telefono" as const;

export const CLIENTE_DETAIL_COLUMNS =
  "id, nombre, rfc, direccion, ciudad, estado, cp, contacto, telefono, email, organization_id, created_at, updated_at" as const;

export const CONTACTO_COLUMNS =
  "id, cliente_id, tipo, nombre, contacto, rfc, telefono, email, direccion, ciudad, pais, organization_id, created_at" as const;

// ============================================================
// Listados / búsqueda
// ============================================================

export interface FetchClientesPaginadosParams {
  search: string;
  page: number;
  pageSize: number;
  organizationId: string | null;
}

export async function fetchClientesPaginados({
  search,
  page,
  pageSize,
  organizationId,
}: FetchClientesPaginadosParams) {
  let query = supabase
    .from("clientes")
    .select(CLIENTE_LIST_COLUMNS, { count: "exact" })
    .order("nombre");

  if (organizationId) query = query.eq("organization_id", organizationId);
  if (search) {
    query = query.or(`nombre.ilike.%${search}%,rfc.ilike.%${search}%`);
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function fetchClientes(organizationId: string | null) {
  let query = supabase
    .from("clientes")
    .select(CLIENTE_LIST_COLUMNS)
    .order("nombre");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchClientesForSelect(organizationId: string | null) {
  let query = supabase
    .from("clientes")
    .select("id, nombre")
    .order("nombre");
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ============================================================
// Detalle
// ============================================================

export async function fetchCliente(id: string) {
  const { data, error } = await supabase
    .from("clientes")
    .select(CLIENTE_DETAIL_COLUMNS)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

/** Días de crédito por defecto del cliente (para precargar el diálogo de proforma). */
export async function fetchDiasCreditoCliente(
  clienteId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("clientes")
    .select("dias_credito")
    .eq("id", clienteId)
    .maybeSingle();
  if (error) throw error;
  return data?.dias_credito ?? null;
}

// ============================================================
// CRUD Cliente
// ============================================================

export async function createCliente(cliente: TablesInsert<"clientes">) {
  const { data, error } = await supabase
    .from("clientes")
    .insert(cliente)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCliente(
  id: string,
  updates: Partial<Cliente>,
): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// Contactos
// ============================================================

export async function fetchContactosCliente(clienteId: string) {
  const { data, error } = await supabase
    .from("contactos_cliente")
    .select(CONTACTO_COLUMNS)
    .eq("cliente_id", clienteId)
    .order("nombre");
  if (error) throw error;
  return data ?? [];
}

export async function createContacto(
  contacto: TablesInsert<"contactos_cliente">,
) {
  const { data, error } = await supabase
    .from("contactos_cliente")
    .insert(contacto)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateContacto(
  id: string,
  updates: Partial<ContactoCliente>,
) {
  const { error } = await supabase
    .from("contactos_cliente")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteContacto(id: string) {
  const { error } = await supabase
    .from("contactos_cliente")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================================
// Relacionados (embarques / cotizaciones del cliente)
// ============================================================

export async function fetchEmbarquesCliente(clienteId: string) {
  const { data, error } = await supabase
    .from("embarques")
    .select(
      "id, expediente, modo, tipo, estado, etd, eta, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, cliente_nombre",
    )
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCotizacionesCliente(clienteId: string) {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select(
      "id, folio, modo, tipo, origen, destino, estado, subtotal, moneda, created_at",
    )
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
