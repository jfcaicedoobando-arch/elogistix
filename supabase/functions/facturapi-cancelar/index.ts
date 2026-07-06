/**
 * facturapi-cancelar — Cancela un CFDI emitido en Facturapi.
 *
 * Entrada: { factura_id: string, motivo: '01'|'02'|'03'|'04', sustituye_uuid?: string, sustituida_por_factura_id?: string }
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
import { getFacturapiClient, describeFacturapiError } from "../_shared/facturapiClient.ts";

/**
 * Descarga el acuse SAT de cancelación desde FacturApi.
 * Endpoint: GET /invoices/{id}/cancellation_receipt/xml
 * Devuelve { xml, status } — si el SAT aún no procesa la cancelación
 * (típicamente ~unas horas), status='pending' y xml=null.
 */
async function descargarAcuseCancelacion(
  facturapiId: string,
  apiKey: string,
): Promise<{ xml: string | null; status: string }> {
  try {
    const res = await fetch(
      `${FACTURAPI_BASE}/invoices/${facturapiId}/cancellation_receipt/xml`,
      { headers: { Authorization: basicAuthHeader(apiKey) } },
    );
    if (res.status === 200) {
      const xml = await res.text();
      return { xml, status: "accepted" };
    }
    if (res.status === 404 || res.status === 425) {
      // 404 = aún no emitido por SAT; 425 = too early. Se reintenta después.
      return { xml: null, status: "pending" };
    }
    return { xml: null, status: `error_${res.status}` };
  } catch {
    return { xml: null, status: "error_network" };
  }
}
import { validateCancelacionInput, type CancelacionInput } from "./helpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Compat legacy `FACTURAPI_KEY` — multi-tenant resuelto vía SDK (v13.136.4).
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

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

  const rawBody = (await req.json().catch(() => ({}))) as CancelacionInput & { sustituida_por_factura_id?: string };
  // Si viene `sustituida_por_factura_id`, resolver su UUID y forzar motivo 01.
  let sustituyeUuidResuelto: string | undefined = rawBody.sustituye_uuid;
  const sustituidaPorFacturaId: string | null = rawBody.sustituida_por_factura_id ?? null;
  if (sustituidaPorFacturaId) {
    const { data: nueva } = await supabase
      .from("facturas").select("id, uuid_fiscal").eq("id", sustituidaPorFacturaId).maybeSingle();
    if (!nueva?.uuid_fiscal) {
      return json({ error: "sustituta_sin_uuid", message: "La factura sustituta aún no está timbrada." }, 422);
    }
    sustituyeUuidResuelto = nueva.uuid_fiscal as string;
  }

  const validated = validateCancelacionInput({ ...rawBody, sustituye_uuid: sustituyeUuidResuelto });
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

  const resolved = await getFacturapiClient(supabase, factura.organization_id);
  if (!resolved.ok) return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const facturapi = resolved.data.client;

  interface FapiCancelResponse { status?: string }
  let cancelResp: FapiCancelResponse;
  try {
    cancelResp = await facturapi.invoices.cancel(
      factura.facturapi_id,
      { motive: motivo, substitution: sustituye_uuid },
    ) as FapiCancelResponse;
  } catch (err) {
    const { status, detail } = describeFacturapiError(err);
    await supabase.from("bitacora_actividad").insert({
      organization_id: factura.organization_id,
      user_id: userData.user.id,
      accion: "facturapi_cancelar_failed",
      entidad: "factura",
      entidad_id: factura_id,
      detalles: { status, response: detail },
    });
    const message = (detail && typeof detail === "object" && "message" in (detail as Record<string, unknown>) && typeof (detail as Record<string, unknown>).message === "string") ? (detail as Record<string, string>).message : `FacturApi respondió ${status}`;
    return json({ error: "facturapi_error", status, detail, message }, 502);
  }
  const fapiJson = cancelResp;

  // Descarga inmediata del acuse SAT. Si el SAT aún no lo emite, quedará
  // como 'pending' y un cron posterior podrá reintentar. Guardar el XML
  // es OBLIGATORIO por SAT desde 2022 (conservación 5 años).
  const acuse = await descargarAcuseCancelacion(factura.facturapi_id!, resolved.data.apiKey);

  // Si fue sustitución (motivo 01 + sustituta resuelta), marcar estado 'Sustituida'
  // y enlazar `sustituida_por`; si no, el ciclo normal -> 'Cancelada'.
  const esSustitucion = motivo === "01" && !!sustituidaPorFacturaId;
  const updatePayload: Record<string, unknown> = {
    estado: esSustitucion ? "Sustituida" : "Cancelada",
    cancelacion_motivo: motivo,
    cancelado_en: new Date().toISOString(),
    acuse_cancelacion_xml: acuse.xml,
    acuse_cancelacion_fecha: acuse.xml ? new Date().toISOString() : null,
    acuse_cancelacion_status: acuse.status,
  };
  if (esSustitucion) updatePayload.sustituida_por = sustituidaPorFacturaId;

  const { error: updErr } = await supabase
    .from("facturas")
    .update(updatePayload)
    .eq("id", factura_id);
  if (updErr) return json({ error: "db_update_failed", detail: updErr.message }, 500);

  await supabase.from("bitacora_actividad").insert({
    organization_id: factura.organization_id,
    user_id: userData.user.id,
    accion: esSustitucion ? "facturapi_sustituida" : "facturapi_cancelada",
    entidad: "factura",
    entidad_id: factura_id,
    detalles: {
      motivo,
      sustituye_uuid: sustituye_uuid ?? null,
      sustituida_por_factura_id: sustituidaPorFacturaId,
    },
  });

  return json({
    ok: true,
    status: fapiJson.status ?? "canceled",
    sustituida: esSustitucion,
    acuse_status: acuse.status,
    acuse_guardado: !!acuse.xml,
  });
}));

