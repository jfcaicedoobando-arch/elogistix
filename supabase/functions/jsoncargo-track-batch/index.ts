// Edge function: jsoncargo-track-batch
// Cron diario. Sincroniza todos los embarques marítimos activos.
// Auth: requiere header X-Cron-Secret == CRON_SECRET o JWT de super_admin.

// @ts-expect-error Deno remote import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handlePreflight } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import {
  fetchContainerDetails,
  mapNaviera,
  deriveEventsFromContainer,
  parseJsonCargoDate,
} from "../_shared/jsoncargo.ts";

const SLEEP_BETWEEN_CALLS_MS = 250;

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  // @ts-expect-error Deno global
  const apiKey = Deno.env.get("JSONCARGO_API_KEY");
  // @ts-expect-error Deno global
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  // @ts-expect-error Deno global
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // @ts-expect-error Deno global
  const cronSecret = Deno.env.get("CRON_SECRET");

  if (!apiKey) return errorResponse("JSONCARGO_API_KEY no configurada", 500);

  const headerSecret = req.headers.get("X-Cron-Secret");
  if (!cronSecret || headerSecret !== cronSecret) {
    return errorResponse("Unauthorized", 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Trae embarques activos marítimos con contenedor
  const { data: embarques, error } = await admin
    .from("embarques")
    .select("id, contenedor, naviera, organization_id, eta, expediente, estado")
    .eq("modo", "Marítimo")
    .not("contenedor", "is", null)
    .not("estado", "in", "(\"Cerrado\",\"Entregado\")");

  if (error) return errorResponse(`Query error: ${error.message}`, 500);

  const elegibles = (embarques ?? []).filter((e: { naviera: string | null }) =>
    mapNaviera(e.naviera) !== null);

  let okCount = 0;
  let failCount = 0;
  const errores: string[] = [];

  for (const emb of elegibles) {
    const sl = mapNaviera(emb.naviera)!;
    try {
      const result = await fetchContainerDetails(apiKey, emb.contenedor, sl);
      const trackingPayload = {
        embarque_id: emb.id,
        organization_id: emb.organization_id,
        provider: "jsoncargo",
        request_number: emb.contenedor,
        request_type: "container",
        scac: sl,
        status: result.ok ? "ok" : "failed",
        failed_reason: result.ok ? null : (result.errorTitle ?? null),
        last_synced_at: new Date().toISOString(),
        last_event_at: result.ok ? parseJsonCargoDate(result.data?.last_movement_timestamp ?? null) : null,
        raw_payload: result.raw ?? {},
      };
      const { data: existing } = await admin
        .from("tracking_externo").select("id")
        .eq("embarque_id", emb.id).eq("provider", "jsoncargo").maybeSingle();
      if (existing) {
        await admin.from("tracking_externo").update(trackingPayload).eq("id", existing.id);
      } else {
        await admin.from("tracking_externo").insert(trackingPayload);
      }

      if (result.ok && result.data) {
        const eventos = deriveEventsFromContainer(result.data);
        if (eventos.length > 0) {
          const { data: existentes } = await admin
            .from("eventos_embarque")
            .select("tipo, fecha")
            .eq("embarque_id", emb.id)
            .eq("usuario", "jsoncargo");
          const exKeys = new Set(
            (existentes ?? []).map((e: { tipo: string; fecha: string }) =>
              `${e.tipo}|${e.fecha.slice(0, 16)}`),
          );
          const nuevos = eventos.filter((ev) => !exKeys.has(`${ev.tipo}|${ev.fecha.slice(0, 16)}`));
          if (nuevos.length > 0) {
            await admin.from("eventos_embarque").insert(nuevos.map((ev) => ({
              embarque_id: emb.id,
              organization_id: emb.organization_id,
              tipo: ev.tipo,
              descripcion: ev.descripcion,
              ubicacion: ev.ubicacion,
              fecha: ev.fecha,
              usuario: "jsoncargo",
            })));
          }
        }
        const newEta = parseJsonCargoDate(result.data.eta_final_destination);
        if (newEta && newEta.slice(0, 10) !== emb.eta) {
          await admin.from("embarques").update({ eta: newEta.slice(0, 10) }).eq("id", emb.id);
        }
        okCount++;
      } else {
        failCount++;
        errores.push(`${emb.expediente}: ${result.errorTitle}`);
      }
    } catch (err) {
      failCount++;
      errores.push(`${emb.expediente}: ${err instanceof Error ? err.message : "error"}`);
    }
    await new Promise((r) => setTimeout(r, SLEEP_BETWEEN_CALLS_MS));
  }

  return jsonResponse({
    ok: true,
    procesados: elegibles.length,
    exitosos: okCount,
    fallidos: failCount,
    errores: errores.slice(0, 20),
  });
});
