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
import { translateLcCode } from "@/lib/errors";
import { logger } from "@/lib/observability/logger";

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
    // FIX-R2-03: centralizamos la traducción de tokens LC_* en el catálogo
    // `lcCodeMessages`. Si no matchea ningún código, relanzamos el error crudo.
    const raw = typeof error.message === "string" ? error.message : "";
    const friendly = translateLcCode(raw);
    if (friendly && friendly !== raw) {
      throw new Error(friendly);
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
    logger.warn("portal", "notificar-respuesta-cotizacion falló (best-effort)", notifyErr);
  }
}

