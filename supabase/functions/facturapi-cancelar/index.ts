/**
 * facturapi-cancelar — Cancela un CFDI emitido en Facturapi.
 *
 * Entrada: { factura_id: string, motivo: '01'|'02'|'03'|'04', sustituye_uuid?: string }
 * Motivos SAT:
 *   01 = Comprobante emitido con errores con relación
 *   02 = Comprobante emitido con errores sin relación
 *   03 = No se llevó a cabo la operación
 *   04 = Operación nominativa relacionada en una factura global
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";

import { resolveFacturapiKey, FACTURAPI_BASE, basicAuthHeader } from "../_shared/facturapiAuth.ts";
import { buildCancelQuery, validateCancelacionInput, type CancelacionInput } from "./helpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Compat legacy `FACTURAPI_KEY` — multi-tenant resuelto en resolveFacturapiKey (v13.136.0).
void Deno.env.get("FACTURAPI_KEY");

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(wrapEdgeHandler("facturapi-cancelar", async (req) => {
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

  const body = (await req.json().catch(() => ({}))) as CancelacionInput;
  const validated = validateCancelacionInput(body);
  if (!validated.ok) {
    return json({ error: validated.error, ...(validated.message ? { message: validated.message } : {}) }, 400);
  }
  const { factura_id, motivo, sustituye_uuid } = validated.data;

  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select("id, facturapi_id, organization_id, estado")
    .eq("id", factura_id)
    .maybeSingle();
  if (fErr || !factura) return json({ error: "factura_not_found" }, 404);
  if (!factura.facturapi_id) return json({ error: "no_timbrada" }, 409);

  const resolved = await resolveFacturapiKey(supabase, factura.organization_id);
  if (!resolved.ok) return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const FACTURAPI_KEY = resolved.data.apiKey;


  const query = buildCancelQuery(motivo, sustituye_uuid);

  const fapiRes = await fetch(`${FACTURAPI_BASE}/invoices/${factura.facturapi_id}?${query}`, {
    method: "DELETE",
    headers: { "Authorization": basicAuthHeader(FACTURAPI_KEY) },
  });
  const fapiJson = await fapiRes.json().catch(() => ({}));
  if (!fapiRes.ok) {
    await supabase.from("bitacora_actividad").insert({
      organization_id: factura.organization_id,
      user_id: userData.user.id,
      accion: "facturapi_cancelar_failed",
      entidad: "factura",
      entidad_id: factura_id,
      detalle: { status: fapiRes.status, response: fapiJson },
    });
    return json({ error: "facturapi_error", status: fapiRes.status, detail: fapiJson }, 502);
  }

  const { error: updErr } = await supabase
    .from("facturas")
    .update({
      estado: "Cancelada",
      cancelacion_motivo: motivo,
      cancelado_en: new Date().toISOString(),
    })
    .eq("id", factura_id);
  if (updErr) return json({ error: "db_update_failed", detail: updErr.message }, 500);

  await supabase.from("bitacora_actividad").insert({
    organization_id: factura.organization_id,
    user_id: userData.user.id,
    accion: "facturapi_cancelada",
    entidad: "factura",
    entidad_id: factura_id,
    detalle: { motivo, sustituye_uuid: sustituye_uuid ?? null },
  });

  return json({ ok: true, status: fapiJson.status ?? "canceled" });
}));
