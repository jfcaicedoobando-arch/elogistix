/**
 * facturapi-cancelar-rep — Cancela un REP (Complemento de Pagos) emitido en Facturapi.
 *
 * Entrada: { pago_id: string, motivo: '01'|'02'|'03'|'04', sustituye_uuid?: string }
 * v13.91.0
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";

import { resolveFacturapiKey, FACTURAPI_BASE, basicAuthHeader } from "../_shared/facturapiAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Compat legacy `FACTURAPI_KEY` — multi-tenant resuelto en resolveFacturapiKey (v13.136.0).
void Deno.env.get("FACTURAPI_KEY");

const MOTIVOS_VALIDOS = new Set(["01", "02", "03", "04"]);

interface ReqBody { pago_id?: string; motivo?: string; sustituye_uuid?: string }

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// eslint-disable-next-line complexity
Deno.serve(wrapEdgeHandler("facturapi-cancelar-rep", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData.user) return json({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as ReqBody;
  if (!body.pago_id) return json({ error: "pago_id_required" }, 400);
  if (!body.motivo || !MOTIVOS_VALIDOS.has(body.motivo)) {
    return json({ error: "motivo_invalido", message: "Motivo debe ser 01, 02, 03 o 04." }, 400);
  }
  if (body.motivo === "01" && !body.sustituye_uuid) {
    return json({ error: "sustituye_uuid_requerido", message: "Motivo 01 requiere sustituye_uuid del REP nuevo." }, 400);
  }

  const { data: pago, error: pErr } = await supabase
    .from("pagos_factura")
    .select("id, organization_id, facturapi_rep_id, estado_rep")
    .eq("id", body.pago_id)
    .maybeSingle();
  if (pErr || !pago) return json({ error: "pago_not_found" }, 404);
  if (!pago.facturapi_rep_id) return json({ error: "no_timbrado_rep" }, 409);
  if (pago.estado_rep === "Cancelado") return json({ error: "ya_cancelado" }, 409);

  const resolved = await resolveFacturapiKey(supabase, pago.organization_id);
  if (!resolved.ok) return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const FACTURAPI_KEY = resolved.data.apiKey;


  const queryParts: string[] = [`motive=${encodeURIComponent(body.motivo)}`];
  if (body.sustituye_uuid) queryParts.push(`substitution=${encodeURIComponent(body.sustituye_uuid)}`);
  const query = queryParts.join("&");

  const fapiRes = await fetch(`${FACTURAPI_BASE}/invoices/${pago.facturapi_rep_id}?${query}`, {
    method: "DELETE",
    headers: { "Authorization": basicAuthHeader(FACTURAPI_KEY) },
  });
  const fapiJson = await fapiRes.json().catch(() => ({}));
  if (!fapiRes.ok) {
    await supabase.from("bitacora_actividad").insert({
      organization_id: pago.organization_id,
      user_id: userData.user.id,
      accion: "facturapi_rep_cancelar_failed",
      entidad: "pago_factura",
      entidad_id: pago.id,
      detalle: { status: fapiRes.status, response: fapiJson },
    });
    return json({ error: "facturapi_error", status: fapiRes.status, detail: fapiJson }, 502);
  }

  const { error: updErr } = await supabase
    .from("pagos_factura")
    .update({
      estado_rep: "Cancelado",
      rep_cancelado_en: new Date().toISOString(),
      rep_motivo_cancel: body.motivo,
    })
    .eq("id", pago.id);
  if (updErr) return json({ error: "db_update_failed", detail: updErr.message }, 500);

  await supabase.from("bitacora_actividad").insert({
    organization_id: pago.organization_id,
    user_id: userData.user.id,
    accion: "facturapi_rep_cancelado",
    entidad: "pago_factura",
    entidad_id: pago.id,
    detalle: { motivo: body.motivo, sustituye_uuid: body.sustituye_uuid ?? null },
  });

  return json({ ok: true, status: fapiJson.status ?? "canceled" });
}));
