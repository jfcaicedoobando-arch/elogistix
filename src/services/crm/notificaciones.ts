/**
 * Servicio CRM — Notificaciones in-app.
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/observability/logger";

export interface CrmNotificacionRow {
  id: string;
  user_id: string;
  organization_id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  link: string | null;
  leida_at: string | null;
  created_at: string;
}

const COLS = "id, user_id, organization_id, tipo, titulo, mensaje, link, leida_at, created_at";

export async function fetchNotificaciones(
  userId: string,
  limit = 20,
): Promise<CrmNotificacionRow[]> {
  const { data, error } = await supabase
    .from("crm_notificaciones")
    .select(COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CrmNotificacionRow[];
}

export async function fetchNotificacionesNoLeidasCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("crm_notificaciones")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("leida_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function marcarNotificacionesLeidas(input: {
  userId: string;
  ids?: string[];
}): Promise<void> {
  let q = supabase
    .from("crm_notificaciones")
    .update({ leida_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .is("leida_at", null);
  if (input.ids && input.ids.length > 0) q = q.in("id", input.ids);
  const { error } = await q;
  if (error) throw error;
}

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
