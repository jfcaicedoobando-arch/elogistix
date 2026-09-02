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
  computeSignatureBytes,
  leerCuerpoAcotado,
  MAX_WEBHOOK_BYTES,
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
    .select("id, organization_id, estado_rep, rep_cancellation_status")
    .eq("facturapi_rep_id", receipt.facturapi_rep_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!pago) return jsonResponse({ ok: true, ignored: "pago_not_found" });

  // EF-06 (guard N3 para REP): eventos fuera de orden no deben resucitar un
  // REP cancelado (receipt.status_updated(valid) tardío tras receipt.canceled)
  // ni regresar rep_cancellation_status accepted → pending/verifying.
  const patch: Record<string, unknown> = { ...receipt.patch };
  if (pago.estado_rep === "Cancelado" && patch.estado_rep === "Timbrado") {
    delete patch.estado_rep;
    delete patch.timbrado_rep_en;
  }
  if (
    pago.rep_cancellation_status === "accepted" &&
    typeof patch.rep_cancellation_status === "string" &&
    patch.rep_cancellation_status !== "accepted"
  ) {
    delete patch.rep_cancellation_status;
  }
  if (Object.keys(patch).length === 0) return jsonResponse({ ok: true, ignored: "estado_ya_avanzado" });

  const { error: updErr } = await supabase
    .from("pagos_factura")
    .update(patch)
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
    .select("id, organization_id, estado, sustituida_por, cancellation_status")
    .eq("facturapi_id", mapped.facturapi_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!factura) return jsonResponse({ ok: true, ignored: "factura_not_found" });

  // Si el evento cancela pero la factura fue sustitución, NO sobrescribimos
  // `estado` — el cron de reconciliación lo fija a "Sustituida" al descargar
  // el acuse. Sí conservamos el resto del patch.
  const patch: Record<string, unknown> = { ...mapped.patch };
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

  // EF-06: un cancellation_status_updated(pending/verifying) retrasado no debe
  // regresar una cancelación ya aceptada (retries/reordenamiento de Facturapi).
  if (
    factura.cancellation_status === "accepted" &&
    typeof patch.cancellation_status === "string" &&
    patch.cancellation_status !== "accepted"
  ) {
    delete patch.cancellation_status;
    delete patch.cancelacion_solicitada_en;
    delete patch.cancelacion_vence_en;
  }
  // El cierre de una cancelación aceptada (estado Cancelada/Sustituida +
  // factura_embarques + proforma) vive en la RPC compartida con
  // facturapi-cancelar; NO se persiste el patch crudo con
  // `cancellation_status=accepted` para no duplicar/desincronizar la lógica.
  if (patch.cancellation_status === "accepted") {
    const { error: rpcErr } = await supabase.rpc("cerrar_cancelacion_factura_facturapi", {
      p_factura_id: factura.id,
    });
    if (rpcErr) return jsonResponse({ error: "cerrar_cancelacion_failed", detail: rpcErr.message }, 500);
    delete patch.estado;
    delete patch.cancellation_status;
    delete patch.cancelado_en;
    delete patch.cancelacion_solicitada_en;
    delete patch.cancelacion_vence_en;
  }

  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await supabase
      .from("facturas")
      .update(patch)
      .eq("id", factura.id);
    if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);
  }

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

/**
 * Ola 5 · RG4-10 · dispatch: los eventos `receipt.*` van directo a REP.
 * Los `invoice.*` se intentan primero como factura y SÓLO si el id no matcheó
 * ninguna factura de la org (`factura_not_found`) se reintentan como REP —
 * FacturAPI a veces notifica la cancelación de un complemento con `invoice.*`.
 */
async function despacharEvento(
  supabase: SB, orgId: string, event: FacturapiWebhookEvent,
): Promise<Response> {
  const receipt = mapEventToReceiptPatch(event);
  if (receipt && event.type.startsWith("receipt.")) {
    return handleReceiptEvent(supabase, orgId, event, receipt);
  }

  const result = await handleFacturaEvent(supabase, orgId, event);
  if (!receipt || !result.ok) return result;

  const body = await result.clone().json().catch(() => null);
  if ((body as { ignored?: string } | null)?.ignored !== "factura_not_found") return result;
  return handleReceiptEvent(supabase, orgId, event, receipt);
}


/**
 * Verifica firma sobre los BYTES exactos aceptados y parsea el evento.
 * Devuelve Response en caso de rechazo.
 */
async function validarEvento(
  bytes: Uint8Array, rawBody: string, signature: string, secret: string,
): Promise<FacturapiWebhookEvent | Response> {
  const expected = await computeSignatureBytes(bytes, secret);
  if (!signature || !safeEqual(signature, expected)) {
    return jsonResponse({ error: "invalid_signature" }, 401);
  }
  try {
    return JSON.parse(rawBody) as FacturapiWebhookEvent;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
}

/**
 * EF-07 + FIX-22 + Ola 4 · N2 · Dedupe ATÓMICO (INSERT-first): el constraint
 * UNIQUE (organization_id, event_id) convierte el 23505 en "ya procesado/en
 * progreso" — dos entregas concurrentes ya no pasan ambas el SELECT.
 * Extraído del handler para respetar el límite de complejidad.
 */
async function reservarEvento(
  // deno-lint-ignore no-explicit-any
  supabase: any, orgId: string, eventKey: string, event: FacturapiWebhookEvent,
): Promise<Response | null> {
  const { error: dedupeErr } = await supabase
    .from("facturapi_webhook_eventos")
    .insert({
      organization_id: orgId,
      event_id: eventKey,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
    });
  if ((dedupeErr as { code?: string } | null)?.code === "23505") {
    // Fase 7 · Alerta suave: FacturAPI reintenta ante 5xx, así que algunos
    // duplicados son esperados; se envían como `info` para dashboard.
    await captureEdgeMessage("facturapi_webhook_duplicate", "info", {
      fn: "facturapi-webhook",
      organization_id: orgId,
      extra: { event_id: eventKey, event_type: event.type },
    });
    return jsonResponse({ ok: true, ignored: "duplicate_event", event_id: eventKey });
  }
  if (dedupeErr) {
    // Sin la tabla de dedupe no podemos garantizar at-most-once: mejor 503
    // (FacturAPI reintentará) que procesar sin protección.
    await captureEdgeMessage("facturapi_webhook_dedupe_insert_failed", "warning", {
      fn: "facturapi-webhook",
      organization_id: orgId,
      extra: { event_id: eventKey, event_type: event.type, detail: dedupeErr.message },
    });
    return jsonResponse({ error: "dedupe_unavailable" }, 503);
  }
  return null;
}

// deno-lint-ignore no-explicit-any
async function liberarReserva(supabase: any, orgId: string, eventKey: string): Promise<void> {
  await supabase
    .from("facturapi_webhook_eventos")
    .delete()
    .eq("organization_id", orgId)
    .eq("event_id", eventKey);
}

/**
 * Ronda YAGNI · defecto 5: un evento que llega ANTES de que exista el registro
 * local (`*_not_found`) no está procesado. Antes se respondía 200 y la reserva
 * de dedupe quedaba viva, así que el reintento devolvía `duplicate_event` para
 * siempre y el evento se perdía. Ahora se libera la reserva y se responde 503
 * para que FacturAPI reintente. Los eventos ya completados conservan su reserva
 * y siguen siendo idempotentes.
 */
async function reintentarSiDestinoAusente(
  // deno-lint-ignore no-explicit-any
  supabase: any, orgId: string, eventKey: string,
  event: FacturapiWebhookEvent, result: Response,
): Promise<Response | null> {
  const cuerpoResultado = await result.clone().json().catch(() => null);
  const ignored = (cuerpoResultado as { ignored?: string } | null)?.ignored;
  if (ignored !== "factura_not_found" && ignored !== "pago_not_found") return null;
  await liberarReserva(supabase, orgId, eventKey);
  await captureEdgeMessage("facturapi_webhook_target_not_found", "info", {
    fn: "facturapi-webhook",
    organization_id: orgId,
    extra: { event_id: eventKey, event_type: event.type, ignored },
  });
  return jsonResponse(
    { error: "target_not_found", retryable: true, event_id: eventKey },
    503,
  );
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

  // Ola P2: endpoint público (verify_jwt=false por diseño). Nunca materializar
  // un body ilimitado antes de validar el HMAC: lectura acotada con corte real
  // por bytes leídos, además del rechazo temprano por Content-Length.
  const cuerpo = await leerCuerpoAcotado(req, MAX_WEBHOOK_BYTES);
  if (!cuerpo.ok) {
    return cuerpo.motivo === "too_large"
      ? jsonResponse({ error: "payload_too_large" }, 413)
      : jsonResponse({ error: "invalid_body" }, 400);
  }

  const event = await validarEvento(
    cuerpo.bytes, cuerpo.raw, req.headers.get("facturapi-signature") ?? "", cred.webhook_secret,
  );
  if (event instanceof Response) return event;

  // Dedupe atómico: si el procesamiento falla (no-2xx) se libera la reserva
  // para que el retry de FacturAPI reprocese el evento.
  const eventKey = await computeEventKey(cuerpo.raw, event);
  const reserva = await reservarEvento(supabase, orgId, eventKey, event);
  if (reserva) return reserva;

  const result = await despacharEvento(supabase, orgId, event);

  if (!result.ok) {
    await liberarReserva(supabase, orgId, eventKey);
    return result;
  }

  const reintento = await reintentarSiDestinoAusente(
    supabase, orgId, eventKey, event, result,
  );
  return reintento ?? result;
}));
