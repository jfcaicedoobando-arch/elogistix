import type { SupabaseClient } from "npm:@supabase/supabase-js@2.119.0";
import { captureEdgeException } from "../_shared/sentry.ts";
import { procesarEventoWebhook } from "./procesamiento.ts";

const MAX_EVENTOS_POR_CRON = 10;
const TIEMPO_CRON_WEBHOOK_MS = 5_000;

export async function reprocesarWebhooksPendientes(supabase: SupabaseClient): Promise<void> {
  const limite = performance.now() + TIEMPO_CRON_WEBHOOK_MS;
  const { data, error } = await supabase.from("facturapi_webhook_eventos")
    .select("organization_id, event_id")
    .in("procesamiento_estado", ["procesando", "reintentable"])
    .lte("procesamiento_disponible_en", new Date().toISOString())
    .order("procesamiento_disponible_en", { ascending: true }).order("id", { ascending: true })
    .limit(MAX_EVENTOS_POR_CRON);
  if (error) throw error;

  for (const evento of data ?? []) {
    if (performance.now() >= limite) break;
    try {
      await procesarEventoWebhook(supabase, evento.organization_id, evento.event_id);
    } catch (error) {
      await captureEdgeException(error, {
        fn: "facturapi-reconciliar-cancelaciones", organization_id: evento.organization_id,
        extra: { event_id: evento.event_id },
      });
    }
  }
}
