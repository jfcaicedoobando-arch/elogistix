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
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import {
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

  // FIX-22 · Dedupe: FacturAPI reintenta hasta 10× ante 5xx. Sin idempotencia,
  // un update de estado o un pago se replicaría. La UNIQUE (org, event_id)
  // bloquea inserciones repetidas y las respondemos como ok/ignored.
  const eventId = (event as { id?: string }).id ?? null;
  if (eventId) {
    const { error: dupErr } = await supabase
      .from("facturapi_webhook_eventos")
      .insert({
        organization_id: orgId,
        event_id: eventId,
        event_type: event.type,
        payload: event as unknown as Record<string, unknown>,
      });
    if (dupErr) {
      // 23505 = unique_violation → evento ya procesado
      if ((dupErr as { code?: string }).code === "23505") {
        return jsonResponse({ ok: true, ignored: "duplicate_event", event_id: eventId });
      }
      return jsonResponse({ error: "dedupe_insert_failed", detail: dupErr.message }, 500);
    }
  }

  const receipt = mapEventToReceiptPatch(event);
  if (receipt) return handleReceiptEvent(supabase, orgId, event, receipt);
  return handleFacturaEvent(supabase, orgId, event);
}));
