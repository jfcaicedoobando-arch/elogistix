import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

/**
 * Reactiva una cotización que fue marcada automáticamente como
 * "Vencida" o "Archivada" por el job de housekeeping.
 *
 * Ola 6 · A3: la transición se valida y aplica en una sola transacción con la
 * RPC `reactivar_cotizacion_rpc` (antes el update desde el cliente chocaba con
 * el guard de estados y fallaba siempre).
 */
export async function reactivarCotizacion(id: string): Promise<string> {
  const { data, error } = await supabase.rpc("reactivar_cotizacion_rpc", { p_id: id });
  if (error) throw error;
  const nuevoEstado = String(data ?? "Borrador");

  await registrarActividad({
    modulo: "cotizaciones",
    accion: "Reactivó cotización",
    entidadId: id,
    detalles: { estado_nuevo: nuevoEstado },
  });

  return nuevoEstado;
}
