/**
 * Cotizaciones — Conversión: Prospecto → Cliente.
 *
 * Ola 6 · M3: alta del cliente + actualización de la cotización en una sola
 * transacción idempotente (`convertir_prospecto_a_cliente_rpc`). Antes, si el
 * update fallaba, quedaba un cliente duplicado huérfano.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

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
  };
  user: { id: string; email?: string | null } | null;
}

export interface ProspectoAClienteResult {
  id: string;
  nombre: string;
  creado: boolean;
}

export async function convertirProspectoACliente(
  input: ProspectoAClienteInput,
): Promise<ProspectoAClienteResult> {
  const { cotizacionId, clienteData, user } = input;
  const { data, error } = await supabase.rpc("convertir_prospecto_a_cliente_rpc", {
    p_cotizacion_id: cotizacionId,
    p_cliente: clienteData,
  });
  if (error) throw error;

  const payload = (data ?? {}) as { cliente_id?: string; nombre?: string; creado?: boolean };
  if (!payload.cliente_id) throw new Error("No se pudo convertir el prospecto a cliente");
  const resultado: ProspectoAClienteResult = {
    id: payload.cliente_id,
    nombre: payload.nombre ?? clienteData.nombre,
    creado: payload.creado === true,
  };

  if (user) {
    await registrarActividad({
      modulo: "cotizaciones",
      accion: "convertir_prospecto_a_cliente",
      entidadId: cotizacionId,
      entidadNombre: resultado.nombre,
      detalles: { cliente_id: resultado.id, cliente_creado: resultado.creado },
    });
  }

  return resultado;
}
