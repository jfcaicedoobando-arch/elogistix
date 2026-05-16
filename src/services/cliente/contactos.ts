import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type ContactoCliente = Tables<"contactos_cliente">;

export const CONTACTO_COLUMNS =
  "id, cliente_id, tipo, nombre, contacto, rfc, telefono, email, direccion, ciudad, pais, organization_id, created_at, deleted_at, deleted_by" as const;

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
