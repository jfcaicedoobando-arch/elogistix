/**
 * Servicio: notificaciones internas. Encapsula los queries/mutations contra
 * `public.notificaciones_internas`. Los hooks consumen este servicio en lugar
 * de importar `supabase` directamente (Fase 2 — capa de servicios).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr, run } from "@/lib/supabase/response";
import type { Database } from "@/integrations/supabase/types";

export type NotificacionInterna =
  Database["public"]["Tables"]["notificaciones_internas"]["Row"];

const MAX_RECIENTES = 50;

export async function fetchNotificaciones(userId: string): Promise<NotificacionInterna[]> {
  return unwrapOr(
    supabase
      .from("notificaciones_internas")
      .select("*")
      .eq("usuario_id", userId)
      .order("created_at", { ascending: false })
      .range(0, MAX_RECIENTES - 1),
    [],
  );
}

export async function marcarLeida(id: string): Promise<void> {
  await run(
    supabase
      .from("notificaciones_internas")
      .update({ leida: true, leida_at: new Date().toISOString() })
      .eq("id", id),
  );
}

export async function marcarTodasLeidas(userId: string): Promise<void> {
  await run(
    supabase
      .from("notificaciones_internas")
      .update({ leida: true, leida_at: new Date().toISOString() })
      .eq("usuario_id", userId)
      .eq("leida", false),
  );
}


/** Suscribe al canal realtime; devuelve función de cleanup. */
export function subscribeNotificaciones(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`notif-internas-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notificaciones_internas",
        filter: `usuario_id=eq.${userId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
