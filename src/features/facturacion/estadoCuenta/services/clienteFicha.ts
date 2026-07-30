/**
 * Servicio: consulta ficha básica de cliente para el encabezado del estado de
 * cuenta (PDF y pantalla). Extraído de useExportActions para respetar la
 * jerarquía hooks → services → supabase client.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ClienteFichaEstadoCuenta {
  id: string;
  nombre: string;
  rfc: string | null;
  direccion: string | null;
  ciudad: string | null;
  estado: string | null;
  dias_credito: number | null;
  limite_credito_mxn: number | null;
}

export async function fetchClienteFichaEstadoCuenta(
  clienteId: string,
): Promise<ClienteFichaEstadoCuenta> {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombre, rfc, direccion, ciudad, estado, dias_credito, limite_credito_mxn")
    .eq("id", clienteId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Cliente no encontrado");
  return {
    id: data.id,
    nombre: data.nombre ?? "",
    rfc: data.rfc ?? null,
    direccion: data.direccion ?? null,
    ciudad: data.ciudad ?? null,
    estado: data.estado ?? null,
    dias_credito: data.dias_credito ?? null,
    limite_credito_mxn: data.limite_credito_mxn ?? null,
  };
}
