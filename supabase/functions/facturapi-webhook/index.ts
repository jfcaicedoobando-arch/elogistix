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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(wrapEdgeHandler("facturapi-webhook", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const orgId = url.searchParams.get("org");
  if (!orgId) return json({ error: "missing_org_param" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: cred } = await supabase
    .from("facturapi_credenciales")
    .select("webhook_secret")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!cred?.webhook_secret) return json({ error: "webhook_not_configured" }, 412);

  const rawBody = await req.text();
  const signature = req.headers.get("facturapi-signature") ?? "";
  const expected = await computeSignature(rawBody, cred.webhook_secret);
  if (!signature || !safeEqual(signature, expected)) {
    return json({ error: "invalid_signature" }, 401);
  }

  let event: FacturapiWebhookEvent;
  try { event = JSON.parse(rawBody); } catch { return json({ error: "invalid_json" }, 400); }

  const mapped = mapEventToFacturaPatch(event);
  if (!mapped) return json({ ok: true, ignored: true });

  const { data: factura } = await supabase
    .from("facturas")
    .select("id, organization_id")
    .eq("facturapi_id", mapped.facturapi_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!factura) return json({ ok: true, ignored: "factura_not_found" });

  const { error: updErr } = await supabase
    .from("facturas")
    .update(mapped.patch)
    .eq("id", factura.id);
  if (updErr) return json({ error: "db_update_failed", detail: updErr.message }, 500);

  await supabase.from("bitacora_actividad").insert({
    organization_id: orgId,
    user_id: null,
    accion: mapped.bitacora_accion,
    entidad: "factura",
    entidad_id: factura.id,
    detalle: { event_type: event.type, patch: mapped.patch },
  });

  return json({ ok: true });
}));
