/**
 * Servicio Portal — Notificaciones del cliente.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr, run } from "@/lib/supabase/response";
import type { NotificacionCliente } from "@/features/portal/types/portal";

export async function fetchNotificacionesCliente(): Promise<NotificacionCliente[]> {
  const rows = await unwrapOr(
    supabase
      .from("notificaciones_cliente")
      .select("id, tipo, titulo, mensaje, url, leida_at, embarque_id, factura_id, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    [],
  );
  return rows as NotificacionCliente[];
}

export async function marcarNotificacionLeida(id: string): Promise<void> {
  await run(supabase.rpc("notificacion_cliente_marcar_leida", { p_id: id }));
}

export async function marcarTodasNotificacionesLeidas(): Promise<void> {
  await run(supabase.rpc("notificaciones_cliente_marcar_todas_leidas"));
}
