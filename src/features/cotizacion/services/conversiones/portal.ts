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

  // AUDIT(hallazgo-17) Fase 2.1 — Email a operaciones (inactivo hasta configurar dominio de email).
  // Cuando se complete `setup_email_infra` + `scaffold_transactional_email` y el
  // template `cotizacion-respuesta` esté registrado en registry.ts, descomentar:
  //
  // await supabase.functions.invoke("send-transactional-email", {
  //   body: {
  //     templateName: "cotizacion-respuesta",
  //     // recipientEmail: <email de operador/admin resuelto en backend>,
  //     idempotencyKey: `cotizacion-respuesta-${cotizacionId}-${respuesta}`,
  //     templateData: { /* folio, cliente, estado, comentario, enlace */ },
  //   },
  // });
  //
  // Nota: el envío real probablemente se mueva a un trigger/edge function que
  // resuelva destinatarios en backend, ya que el cliente del portal NO debe
  // poder elegir a quién se le envía el email.
}

