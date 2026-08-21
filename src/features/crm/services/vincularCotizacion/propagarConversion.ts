/**
 * Propaga la conversión de prospecto → cliente al pipeline CRM.
 *
 * OLA 7 · O7.7 — una sola RPC transaccional (`crm_propagar_conversion_cliente`).
 * Antes eran 3 escrituras sueltas y un fallo intermedio dejaba el lead sin
 * convertir aunque el cliente ya existiera.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

/**
 * Llamado tras `convertirProspectoACliente`. Propaga el cliente al CRM:
 * - Setea cliente_id/cliente_nombre en la oportunidad.
 * - Marca el lead asociado como Convertido.
 * Ambas escrituras ocurren en la misma transacción del servidor.
 */
export async function propagarConversionProspectoCRM(input: {
  oportunidadId: string | null;
  clienteId: string;
  clienteNombre: string;
}): Promise<void> {
  if (!input.oportunidadId) return;

  const { error } = await supabase.rpc("crm_propagar_conversion_cliente", {
    p_oportunidad_id: input.oportunidadId,
    p_cliente_id: input.clienteId,
    p_cliente_nombre: input.clienteNombre,
  });
  if (error) throw error;

  await registrarActividad({
    modulo: "crm",
    accion: "propagar_conversion_prospecto",
    entidadId: input.oportunidadId,
    entidadNombre: input.clienteNombre,
    detalles: { cliente_id: input.clienteId },
  });
}
