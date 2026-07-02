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
  const { data } = await supabase
    .from("proforma_envios")
    .select("destinatarios, cc, created_at, proformas!inner(cliente_id)")
    .eq("proformas.cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(20);
  // SAFE-CAST: PostgREST devuelve el join anidado `proformas` como objeto;
  // sólo leemos los campos planos ya seleccionados en el .select().
  return (data ?? []) as unknown as EnvioDestinatariosRow[];
}

export async function fetchContactosEmailPorCliente(
  clienteId: string,
): Promise<ContactoEmailRow[]> {
  const { data } = await supabase
    .from("contactos_cliente")
    .select("email")
    .eq("cliente_id", clienteId)
    .is("deleted_at", null);
  // SAFE-CAST: fila plana; el tipo generado incluye columnas no seleccionadas.
  return (data ?? []) as unknown as ContactoEmailRow[];
}
