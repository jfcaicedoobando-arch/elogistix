/**
 * facturapi-webhook — Recibe eventos de FacturApi y sincroniza el estado en
 * `public.facturas`. Multi-tenant: la URL del webhook DEBE incluir
 * `?org=<organization_id>` para resolver el `webhook_secret` correcto.
 *
 * Configurar en FacturApi Dashboard → Webhooks:
 *   https://<project>.functions.supabase.co/facturapi-webhook?org=<UUID_ORG>
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler, captureEdgeMessage } from "../_shared/sentry.ts";
import {
  computeEventKey,
  computeSignature,
  mapEventToFacturaPatch,
  mapEventToReceiptPatch,
  safeEqual,
  type FacturapiWebhookEvent,
} from "./helpers.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

async function handleReceiptEvent(
  supabase: SB, orgId: string, event: FacturapiWebhookEvent,
  receipt: NonNullable<ReturnType<typeof mapEventToReceiptPatch>>,
): Promise<Response> {
  const { data: pago } = await supabase
    .from("pagos_factura")
    .select("id, organization_id")
    .eq("facturapi_rep_id", receipt.facturapi_rep_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!pago) return jsonResponse({ ok: true, ignored: "pago_not_found" });

  const { error: updErr } = await supabase
    .from("pagos_factura")
    .update(receipt.patch)
    .eq("id", pago.id);
  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);

  await registrarBitacoraEdge(supabase, {
    organizationId: orgId,
    usuarioId: null,
    modulo: "facturacion",
    accion: receipt.bitacora_accion,
    entidadId: pago.id,
    detalles: { event_type: event.type, patch: receipt.patch },
  });
  return jsonResponse({ ok: true, target: "pagos_factura" });
}

async function handleFacturaEvent(
  supabase: SB, orgId: string, event: FacturapiWebhookEvent,
): Promise<Response> {
  const mapped = mapEventToFacturaPatch(event);
  if (!mapped) return jsonResponse({ ok: true, ignored: true });

  const { data: factura } = await supabase
    .from("facturas")
    .select("id, organization_id, estado, sustituida_por")
    .eq("facturapi_id", mapped.facturapi_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!factura) return jsonResponse({ ok: true, ignored: "factura_not_found" });

  // Si el evento cancela pero la factura fue sustitución, NO sobrescribimos
  // `estado` — el cron de reconciliación lo fija a "Sustituida" al descargar
  // el acuse. Sí conservamos el resto del patch.
  const patch = { ...mapped.patch };
  if (mapped.preserva_sustituida && (factura.estado === "Sustituida" || factura.sustituida_por)) {
    delete patch.estado;
  }

  // Ola 4 · N3: un evento `valid` tardío (re-notificación de FacturAPI) no
  // debe regresar a "Emitida" una factura que ya avanzó en su ciclo de vida
  // (Pagada, Vencida, Parcialmente pagada, Cancelada, Sustituida).
  const ESTADOS_HASTA_EMISION = new Set(["Borrador", "Por timbrar", "Emitida"]);
  if (patch.estado === "Emitida" && (!factura.estado || !ESTADOS_HASTA_EMISION.has(factura.estado))) {
    delete patch.estado;
  }
  if (Object.keys(patch).length === 0) return jsonResponse({ ok: true, ignored: "estado_ya_avanzado" });

  const { error: updErr } = await supabase
    .from("facturas")
    .update(patch)
    .eq("id", factura.id);
  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);

  await registrarBitacoraEdge(supabase, {
    organizationId: orgId,
    usuarioId: null,
    modulo: "facturacion",
    accion: mapped.bitacora_accion,
    entidadId: factura.id,
    detalles: { event_type: event.type, patch: mapped.patch },
  });
  return jsonResponse({ ok: true });
}

Deno.serve(wrapEdgeHandler("facturapi-webhook", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const orgId = url.searchParams.get("org");
  if (!orgId) return jsonResponse({ error: "missing_org_param" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: cred } = await supabase
    .from("facturapi_credenciales")
    .select("webhook_secret")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!cred?.webhook_secret) return jsonResponse({ error: "webhook_not_configured" }, 412);

  const rawBody = await req.text();
  const signature = req.headers.get("facturapi-signature") ?? "";
  const expected = await computeSignature(rawBody, cred.webhook_secret);
  if (!signature || !safeEqual(signature, expected)) {
    return jsonResponse({ error: "invalid_signature" }, 401);
  }

  let event: FacturapiWebhookEvent;
  try { event = JSON.parse(rawBody); } catch { return jsonResponse({ error: "invalid_json" }, 400); }

  // FIX-22 + Ola 4 · N2 · Dedupe: `computeEventKey` usa `event.id` y cae a
  // `sha256:<hash del body>` cuando falta. Antes la fila se insertaba ANTES
  // de procesar: si el handler devolvía 500, los reintentos de FacturAPI
  // chocaban con el unique y el evento se perdía para siempre.
  // Nuevo orden: (1) chequeo de dedupe, (2) procesar, (3) registrar dedupe
  // SÓLO si el procesamiento fue 2xx.
  const eventKey = await computeEventKey(rawBody, event);
  const { data: eventoPrevio } = await supabase
    .from("facturapi_webhook_eventos")
    .select("id")
    .eq("organization_id", orgId)
    .eq("event_id", eventKey)
    .maybeSingle();
  if (eventoPrevio) {
    // Fase 7 · Alerta suave: FacturAPI reintenta ante 5xx, así que algunos
    // duplicados son esperados. Los enviamos como `info` para dashboard;
    // si el volumen sube anormalmente, indica que estamos devolviendo 5xx.
    await captureEdgeMessage("facturapi_webhook_duplicate", "info", {
      fn: "facturapi-webhook",
      organization_id: orgId,
      extra: { event_id: eventKey, event_type: event.type },
    });
    return jsonResponse({ ok: true, ignored: "duplicate_event", event_id: eventKey });
  }

  const receipt = mapEventToReceiptPatch(event);
  const result = receipt
    ? await handleReceiptEvent(supabase, orgId, event, receipt)
    : await handleFacturaEvent(supabase, orgId, event);

  // Ola 4 · N2: si el procesamiento falló (5xx) NO registramos dedupe —
  // el reintento de FacturAPI (hasta 10×) volverá a ejecutar el handler.
  if (!result.ok) return result;

  const { error: dupErr } = await supabase
    .from("facturapi_webhook_eventos")
    .insert({
      organization_id: orgId,
      event_id: eventKey,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
    });
  if (dupErr && (dupErr as { code?: string }).code !== "23505") {
    // El evento YA se procesó: devolver 5xx provocaría un reintento y
    // reproceso innecesario. Sólo alertamos (23505 = carrera con una
    // entrega concurrente del mismo evento; patches idempotentes).
    await captureEdgeMessage("facturapi_webhook_dedupe_insert_failed", "warning", {
      fn: "facturapi-webhook",
      organization_id: orgId,
      extra: { event_id: eventKey, event_type: event.type, detail: dupErr.message },
    });
  }
  return result;
}));
