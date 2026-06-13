/**
 * Servicio CRM — Notificaciones in-app.
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/observability/logger";

export interface CrearNotificacionInput {
  user_id: string;
  tipo: string;
  titulo: string;
  mensaje?: string;
  link?: string | null;
}

/** Inserta una notificación. Falla silenciosamente — nunca debe romper la acción principal. */
export async function crearNotificacionSilencioso(input: CrearNotificacionInput): Promise<void> {
  try {
    await supabase.from("crm_notificaciones").insert({
      user_id: input.user_id,
      tipo: input.tipo,
      titulo: input.titulo,
      mensaje: input.mensaje ?? "",
      link: input.link ?? null,
    });
  } catch (e) {
    logger.warn("[crm_notificaciones] insert falló:", e);
  }
}
