/**
 * facturapi-cancelar-rep — Cancela un REP (Complemento de Pagos) emitido en Facturapi.
 *
 * Entrada: { pago_id: string, motivo: '01'|'02'|'03'|'04', sustituye_uuid?: string }
 * v13.91.0
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";

import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { authorizeOrgRole, ROLES_COBRANZA_FISCAL } from "../_shared/auth.ts";
import { getFacturapiClient, describeFacturapiError } from "../_shared/facturapiClient.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Compat legacy `FACTURAPI_KEY` — multi-tenant resuelto vía SDK (v13.136.4).
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

const MOTIVOS_VALIDOS = new Set(["01", "02", "03", "04"]);

interface ReqBody { pago_id?: string; motivo?: string; sustituye_uuid?: string }

// eslint-disable-next-line complexity
Deno.serve(wrapEdgeHandler("facturapi-cancelar-rep", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData.user) return jsonResponse({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as ReqBody;
  if (!body.pago_id) return jsonResponse({ error: "pago_id_required" }, 400);
  if (!body.motivo || !MOTIVOS_VALIDOS.has(body.motivo)) {
    return jsonResponse({ error: "motivo_invalido", message: "Motivo debe ser 01, 02, 03 o 04." }, 400);
  }
  if (body.motivo === "01" && !body.sustituye_uuid) {
    return jsonResponse({ error: "sustituye_uuid_requerido", message: "Motivo 01 requiere sustituye_uuid del REP nuevo." }, 400);
  }

  const { data: pago, error: pErr } = await supabase
    .from("pagos_factura")
    .select("id, organization_id, facturapi_rep_id, estado_rep")
    .eq("id", body.pago_id)
    .maybeSingle();
  if (pErr || !pago) return jsonResponse({ error: "pago_not_found" }, 404);
  if (!pago.facturapi_rep_id) return jsonResponse({ error: "no_timbrado_rep" }, 409);
  if (pago.estado_rep === "Cancelado") return jsonResponse({ error: "ya_cancelado" }, 409);
  if (!(await authorizeOrgRole(supabase, userData.user.id, pago.organization_id, ROLES_COBRANZA_FISCAL))) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const resolved = await getFacturapiClient(supabase, pago.organization_id);
  if (!resolved.ok) return jsonResponse({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const facturapi = resolved.data.client;

  interface FapiCancelResponse { status?: string }
  let cancelResp: FapiCancelResponse;
  try {
    cancelResp = await facturapi.invoices.cancel(
      pago.facturapi_rep_id,
      { motive: body.motivo, substitution: body.sustituye_uuid },
    ) as FapiCancelResponse;
  } catch (err) {
    const { status, detail } = describeFacturapiError(err);
    await registrarBitacoraEdge(supabase, {
      organizationId: pago.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_rep_cancelar_failed",
      entidadId: pago.id,
      detalles: { status, response: detail },
    });
    const message = (detail && typeof detail === "object" && "message" in (detail as Record<string, unknown>) && typeof (detail as Record<string, unknown>).message === "string") ? (detail as Record<string, string>).message : `FacturApi respondió ${status}`;
    return jsonResponse({ error: "facturapi_error", status, detail, message }, 502);
  }
  const fapiJson = cancelResp;

  const { error: updErr } = await supabase
    .from("pagos_factura")
    .update({
      estado_rep: "Cancelado",
      rep_cancelado_en: new Date().toISOString(),
      rep_motivo_cancel: body.motivo,
    })
    .eq("id", pago.id);
  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);

  await registrarBitacoraEdge(supabase, {
    organizationId: pago.organization_id,
    usuarioId: userData.user.id,
    usuarioEmail: userData.user.email,
    modulo: "facturacion",
    accion: "facturapi_rep_cancelado",
    entidadId: pago.id,
    detalles: { motivo: body.motivo, sustituye_uuid: body.sustituye_uuid ?? null },
  });

  return jsonResponse({ ok: true, status: fapiJson.status ?? "canceled" });
}));
