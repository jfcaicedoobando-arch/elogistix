/**
 * Servicio de datos fiscales del cliente y persistencia de elecciones de
 * timbrado en `facturas`. Aísla la lectura directa de `clientes` y la
 * actualización pre-timbrado del componente `DialogTimbrarFactura`.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ClienteFiscalRow {
  rfc: string | null;
  codigo_postal: string | null;
  regimen_fiscal: string | null;
  uso_cfdi_default: string | null;
}

export async function fetchClienteFiscal(clienteId: string): Promise<ClienteFiscalRow | null> {
  const { data, error } = await supabase
    .from("clientes")
    .select("rfc, codigo_postal, regimen_fiscal, uso_cfdi_default")
    .eq("id", clienteId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ClienteFiscalRow | null;
}

export interface DatosTimbradoPatch {
  serie?: string;
  uso_cfdi: string;
  forma_pago: string;
  metodo_pago: string;
  dias_credito?: number;
  notas?: string | null;
  tipo_cambio?: number | null;
  fecha_emision?: string;
}

export async function actualizarDatosTimbradoFactura(
  facturaId: string,
  patch: DatosTimbradoPatch,
): Promise<void> {
  const { error } = await supabase.from("facturas").update(patch).eq("id", facturaId);
  if (error) throw error;
}
