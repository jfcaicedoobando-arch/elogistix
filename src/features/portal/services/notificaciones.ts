/**
 * Servicio Portal — Notificaciones del cliente.
 */
import { supabase } from "@/integrations/supabase/client";
import type { NotificacionCliente } from "@/features/portal/types/portal";

export async function fetchNotificacionesCliente(): Promise<NotificacionCliente[]> {
  const { data, error } = await supabase
    .from("notificaciones_cliente")
    .select("id, tipo, titulo, mensaje, url, leida_at, embarque_id, factura_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as NotificacionCliente[];
}

export async function marcarNotificacionLeida(id: string): Promise<void> {
  const { error } = await supabase.rpc("notificacion_cliente_marcar_leida", { p_id: id });
  if (error) throw error;
}

export async function marcarTodasNotificacionesLeidas(): Promise<void> {
  const { error } = await supabase.rpc("notificaciones_cliente_marcar_todas_leidas");
  if (error) throw error;
}
