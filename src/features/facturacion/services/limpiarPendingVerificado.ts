/**
 * Servicio para el RPC `limpiar_cancellation_status_verificado`.
 * Extraído del hook para respetar la capa Hooks → Services → Supabase.
 */
import { supabase } from "@/integrations/supabase/client";

export async function limpiarCancellationStatusVerificado(input: {
  facturaId: string;
  remoteCancellationStatus: string;
}): Promise<void> {
  const { error } = await supabase.rpc("limpiar_cancellation_status_verificado", {
    p_factura_id: input.facturaId,
    p_remote_cancellation_status: input.remoteCancellationStatus,
  });
  if (error) throw new Error(error.message);
}
