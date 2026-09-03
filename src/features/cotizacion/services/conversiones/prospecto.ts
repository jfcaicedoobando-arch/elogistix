/**
 * Cotizaciones — Conversión: Prospecto → Cliente.
 *
 * P0 (conversión canónica): TODO ocurre dentro de
 * `convertir_prospecto_a_cliente_rpc`: autorización, validación fiscal, alta o
 * reutilización del cliente, cotización, historial, oportunidad, lead y la
 * ÚNICA actividad de bitácora. Aquí no se escribe nada más: ni bitácora desde
 * el cliente ni propagación CRM posterior (antes podían quedar a medias).
 */
import { supabase } from "@/integrations/supabase/client";

export interface ProspectoAClienteInput {
  cotizacionId: string;
  clienteData: {
    nombre: string;
    contacto: string;
    email: string;
    telefono: string;
    rfc?: string;
    direccion?: string;
    ciudad?: string;
    estado?: string;
    cp?: string;
    regimen_fiscal?: string;
    uso_cfdi_default?: string;
    forma_pago_default?: string;
    metodo_pago_default?: string;
  };
}

export interface ProspectoAClienteResult {
  id: string;
  nombre: string;
  creado: boolean;
  /** `true` cuando fue un reintento: la conversión ya existía y no se escribió nada. */
  sinCambios: boolean;
}

export async function convertirProspectoACliente(
  input: ProspectoAClienteInput,
): Promise<ProspectoAClienteResult> {
  const { cotizacionId, clienteData } = input;
  const { data, error } = await supabase.rpc("convertir_prospecto_a_cliente_rpc", {
    p_cotizacion_id: cotizacionId,
    p_cliente: clienteData,
  });
  if (error) throw error;

  const payload = (data ?? {}) as {
    cliente_id?: string;
    nombre?: string;
    creado?: boolean;
    sin_cambios?: boolean;
  };
  if (!payload.cliente_id) throw new Error("No se pudo convertir el prospecto a cliente");

  return {
    id: payload.cliente_id,
    nombre: payload.nombre ?? clienteData.nombre,
    creado: payload.creado === true,
    sinCambios: payload.sin_cambios === true,
  };
}
