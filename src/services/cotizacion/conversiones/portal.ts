/**
 * Cotizaciones — Conversión: Portal — respuesta del cliente vía RPC.
 */
import { supabase } from "@/integrations/supabase/client";

export async function portalResponderCotizacion(
  cotizacionId: string,
  respuesta: "Aceptada" | "Rechazada",
  comentario: string,
): Promise<void> {
  const { error } = await supabase.rpc("portal_responder_cotizacion", {
    p_cotizacion_id: cotizacionId,
    p_respuesta: respuesta,
    p_comentario: comentario,
  });
  if (error) throw error;
}
