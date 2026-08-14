/**
 * Servicio: política de autorización del cliente ("cliente de casa").
 * Extraído de `useClienteAutorizacion` para respetar la jerarquía
 * hooks → services → supabase client.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ClienteAutorizacion {
  requiereAutorizacionCotizacion: boolean;
  requiereAutorizacionProforma: boolean;
  esClienteDeCasa: boolean;
}

export async function obtenerAutorizacionCliente(
  clienteId: string,
): Promise<ClienteAutorizacion> {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, requiere_autorizacion_cotizacion, requiere_autorizacion_proforma")
    .eq("id", clienteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const cot = data?.requiere_autorizacion_cotizacion ?? true;
  const pro = data?.requiere_autorizacion_proforma ?? true;
  return {
    requiereAutorizacionCotizacion: cot,
    requiereAutorizacionProforma: pro,
    esClienteDeCasa: !cot && !pro,
  };
}
