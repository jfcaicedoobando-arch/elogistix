/**
 * Fetch de destinatarios previos (envíos + contactos) para el modal
 * "Enviar proforma". Capa de servicios — única con acceso a Supabase.
 */
import { supabase } from "@/integrations/supabase/client";

export interface EnvioDestinatariosRow {
  destinatarios: unknown;
  cc: unknown;
  created_at: string;
}
export interface ContactoEmailRow {
  email: string | null;
}

export async function fetchEnviosDestinatariosPorCliente(
  clienteId: string,
): Promise<EnvioDestinatariosRow[]> {
  // EC-08: antes se desestructuraba sólo `data` y el error de PostgREST se
  // tragaba devolviendo [] (falsa "sin sugerencias"); ahora se propaga.
  const { data, error } = await supabase
    .from("proforma_envios")
    .select("destinatarios, cc, created_at, proformas!inner(cliente_id)")
    .eq("proformas.cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  // SAFE-CAST: PostgREST devuelve el join anidado `proformas` como objeto;
  // sólo leemos los campos planos ya seleccionados en el .select().
  return (data ?? []) as unknown as EnvioDestinatariosRow[];
}

export async function fetchContactosEmailPorCliente(
  clienteId: string,
): Promise<ContactoEmailRow[]> {
  const { data, error } = await supabase
    .from("contactos_cliente")
    .select("email")
    .eq("cliente_id", clienteId)
    .is("deleted_at", null)
    // Defensivo: un cliente con cientos de contactos no debe traer todo.
    .limit(200);
  if (error) throw error;
  // SAFE-CAST: fila plana; el tipo generado incluye columnas no seleccionadas.
  return (data ?? []) as unknown as ContactoEmailRow[];
}
