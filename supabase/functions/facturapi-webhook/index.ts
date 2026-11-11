/**
 * facturapi-webhook — Recibe eventos de FacturApi y sincroniza el estado en
 * `public.facturas`. Multi-tenant: la URL del webhook DEBE incluir
 * `?org=<organization_id>` para resolver el `webhook_secret` correcto.
 *
 * Configurar en FacturApi Dashboard → Webhooks:
 *   https://<project>.functions.supabase.co/facturapi-webhook?org=<UUID_ORG>
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.119.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler, captureEdgeException, captureEdgeMessage } from "../_shared/sentry.ts";
import { computeEventKey, leerCuerpoAcotado, MAX_WEBHOOK_BYTES, type FacturapiWebhookEvent } from "../_shared/facturapi-webhook/helpers.ts";
import { jsonResponse } from "../_shared/response.ts";
import { ambienteDeUrl, COLS_WEBHOOK_CRED, secretosDeCredencial, validarEvento } from "./secretos.ts";
import { procesarEventoWebhook } from "../_shared/facturapi-webhook/procesamiento.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function confirmarEntrega(supabase: SupabaseClient, orgId: string, eventKey: string, event: FacturapiWebhookEvent): Promise<Response> {
  try {
    const result = await procesarEventoWebhook(supabase, orgId, eventKey, event);
    if (result.estado === "terminado") {
      const ignored = result.resultado === "agotado" ? "retry_exhausted" : "duplicate_event";
      return jsonResponse({ ok: true, ignored, event_id: eventKey });
    }
    if (result.estado === "procesado") {
      return jsonResponse(result.tabla === "pagos_factura" ? { ok: true, target: result.tabla } : { ok: true });
    }
    if (result.estado === "ignorado") return jsonResponse({ ok: true, ignored: result.motivo });
    const ausente = result.estado === "reintentable" && ["factura_not_found", "pago_not_found"].includes(result.motivo ?? "");
    return jsonResponse({ error: ausente ? "target_not_found" : "webhook_pending", retryable: true, event_id: eventKey }, 503);
  } catch (error) {
    await captureEdgeException(error, {
      fn: "facturapi-webhook", organization_id: orgId,
      extra: { event_id: eventKey, event_type: event.type },
    });
    return jsonResponse({ error: "webhook_unavailable", retryable: true }, 503);
  }
}

Deno.serve(wrapEdgeHandler("facturapi-webhook", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const orgId = url.searchParams.get("org");
  if (!orgId) return jsonResponse({ error: "missing_org_param" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Transición explícita: URL aislada por ambiente (`&amb=`). Sin el parámetro
  // manda el ambiente activo de la credencial.
  const ambienteUrl = ambienteDeUrl(url);
  if (ambienteUrl === "invalido") return jsonResponse({ error: "ambiente_invalido" }, 400);

  const { data: cred } = await supabase
    .from("facturapi_credenciales")
    .select(COLS_WEBHOOK_CRED)
    .eq("organization_id", orgId)
    .maybeSingle();
  // Aislamiento: UN solo secret válido (el del ambiente pedido). Nunca el opuesto.
  const secretos = secretosDeCredencial(cred, ambienteUrl);
  if (secretos.length === 0) return jsonResponse({ error: "webhook_not_configured" }, 412);


  // Ola P2: endpoint público (verify_jwt=false por diseño). Nunca materializar
  // un body ilimitado antes de validar el HMAC: lectura acotada con corte real
  // por bytes leídos, además del rechazo temprano por Content-Length.
  const cuerpo = await leerCuerpoAcotado(req, MAX_WEBHOOK_BYTES);
  if (!cuerpo.ok) {
    return cuerpo.motivo === "too_large"
      ? jsonResponse({ error: "payload_too_large" }, 413)
      : jsonResponse({ error: "invalid_body" }, 400);
  }

  const validado = await validarEvento(
    cuerpo.bytes, cuerpo.raw, req.headers.get("facturapi-signature") ?? "", secretos,
  );
  if (validado instanceof Response) return validado;
  const { event, origen: origenSecret } = validado;
  if (origenSecret === "legacy") {
    // Diagnóstico accionable sin exponer el secret: la org sigue en el campo
    // legado y debe migrar a la configuración por ambiente.
    await captureEdgeMessage("facturapi_webhook_secret_legacy", "warning", {
      fn: "facturapi-webhook",
      organization_id: orgId,
      extra: { event_type: event.type },
    });
  }

  const eventKey = await computeEventKey(cuerpo.raw, event);
  return confirmarEntrega(supabase, orgId, eventKey, event);
}));
