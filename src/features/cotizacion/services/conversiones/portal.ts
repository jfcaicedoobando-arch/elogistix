/**
 * Cotizaciones — Conversión: Portal — respuesta del cliente vía RPC.
 *
 * Tras registrar la respuesta, dispara la notificación por email a
 * operadores/admins de la organización (edge function `notificar-respuesta-cotizacion`
 * resuelve destinatarios server-side; el portal nunca elige a quién se le envía).
 *
 * La notificación es best-effort: un fallo de email NO debe revertir la
 * respuesta del cliente — solo se loggea.
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
  if (error) {
    const msg = typeof error.message === "string" ? error.message : "";
    // FIX-25: tokens LC_* → mensajes claros en es-MX.
    if (/LC_COT_ELIMINADA/.test(msg)) {
      throw new Error("Esta cotización ya no está disponible.");
    }
    if (/LC_COT_NO_RESPONDIBLE/.test(msg)) {
      throw new Error("Esta cotización ya no puede responderse (ya fue respondida o cambió de estado).");
    }
    if (/LC_COT_NO_ENCONTRADA/.test(msg)) {
      throw new Error("Cotización no encontrada o sin acceso.");
    }
    throw error;
  }


  try {
    await supabase.functions.invoke("notificar-respuesta-cotizacion", {
      body: {
        cotizacion_id: cotizacionId,
        estado: respuesta,
        comentario,
      },
    });
  } catch (notifyErr) {
    // Best-effort: no romper el flujo del portal si el email falla.
    console.warn("notificar-respuesta-cotizacion falló (best-effort)", notifyErr);
  }
}

