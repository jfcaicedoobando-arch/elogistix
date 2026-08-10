/**
 * facturapi-cancelar-nota-credito — Cancela un CFDI tipo E (NC) en FacturApi.
 * Motivos SAT 01/02/03/04 igual que en facturas.
 *
 * Entrada: { nota_credito_id, motivo: '01'|'02'|'03'|'04', sustituye_uuid? }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { authorizeOrgRole, ROLES_EMISOR_FISCAL } from "../_shared/auth.ts";
import { getFacturapiClient, describeFacturapiError, extractFacturapiMessage } from "../_shared/facturapiClient.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

const MOTIVOS_VALIDOS = new Set(["01", "02", "03", "04"]);

interface ReqBody {
  nota_credito_id?: string;
  motivo?: string;
  sustituye_uuid?: string;
}

function validateRequest(req: Request, body: ReqBody): Response | null {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!body.nota_credito_id) return jsonResponse({ error: "nota_credito_id_required" }, 400);
  if (!body.motivo || !MOTIVOS_VALIDOS.has(body.motivo)) {
    return jsonResponse({ error: "motivo_invalido", message: "Motivo SAT requerido (01-04)." }, 400);
  }
  if (body.motivo === "01" && !body.sustituye_uuid) {
    return jsonResponse({ error: "sustituye_uuid_required", message: "El motivo 01 requiere UUID de sustitución." }, 400);
  }
  return null;
}

Deno.serve(wrapEdgeHandler("facturapi-cancelar-nota-credito", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData.user) return jsonResponse({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as ReqBody;
  const invalid = validateRequest(req, body);
  if (invalid) return invalid;


  const { data: nc, error: ncErr } = await supabase
    .from("factura_notas_credito")
    .select("id, organization_id, facturapi_id, estado")
    .eq("id", body.nota_credito_id)
    .maybeSingle();
  if (ncErr || !nc) return jsonResponse({ error: "nota_credito_not_found" }, 404);
  if (!nc.facturapi_id) return jsonResponse({ error: "no_timbrada" }, 409);
  if (nc.estado === "Cancelada") return jsonResponse({ error: "ya_cancelada", message: "Esta nota de crédito ya está cancelada." }, 409);
  if (!(await authorizeOrgRole(supabase, userData.user.id, nc.organization_id, ROLES_EMISOR_FISCAL))) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  // Ola 4 · N4: FacturAPI espera el facturapi_id (ObjectId) de la NC
  // sustituta en `substitution`, NO el UUID SAT (mismo patrón que
  // resolveSustitutaSnapshot de facturapi-cancelar). La UI captura el UUID
  // SAT; aquí lo resolvemos a la NC timbrada de ESTA organización.
  let sustituyeFacturapiId: string | undefined;
  if (body.motivo === "01") {
    const { data: sustituta } = await supabase
      .from("factura_notas_credito")
      .select("id, facturapi_id")
      .eq("organization_id", nc.organization_id)
      .eq("uuid_fiscal", body.sustituye_uuid!)
      .maybeSingle();
    if (!sustituta?.facturapi_id) {
      return jsonResponse({
        error: "sustituta_no_encontrada",
        message: "No hay una nota de crédito timbrada con ese UUID en esta organización. Timbra primero la NC sustituta.",
      }, 422);
    }
    sustituyeFacturapiId = sustituta.facturapi_id as string;
  }

  const resolved = await getFacturapiClient(supabase, nc.organization_id);
  if (!resolved.ok) return jsonResponse({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const facturapi = resolved.data.client;

  interface FapiCancelResponse { status?: string; cancellation_status?: string }
  let cancelResp: FapiCancelResponse;
  try {
    // Ola 4 · N4: `substitution` lleva el ObjectId de la sustituta, no el UUID.
    const cancelPayload: { motive: string; substitution?: string } = { motive: body.motivo! };
    if (sustituyeFacturapiId) cancelPayload.substitution = sustituyeFacturapiId;
    cancelResp = await facturapi.invoices.cancel(nc.facturapi_id, cancelPayload) as FapiCancelResponse;
  } catch (err) {
    const { status, detail } = describeFacturapiError(err);
    await registrarBitacoraEdge(supabase, {
      organizationId: nc.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_nc_cancelar_failed",
      entidadId: body.nota_credito_id,
      detalles: { status, response: detail },
    });
    const message = extractFacturapiMessage(detail, status);
    return jsonResponse({ error: "facturapi_error", status, detail, message }, 502);
  }

  // Ola 4 · N4: ramificar por cancellation_status como terminales.ts de
  // facturapi-cancelar — nunca marcar 'Cancelada' si el SAT dejó la
  // cancelación pendiente o el receptor la rechazó en su Buzón.
  const cancellationStatus = (cancelResp.cancellation_status ?? "none").toLowerCase();
  const invoiceStatus = (cancelResp.status ?? "").toLowerCase();
  const nowIso = new Date().toISOString();
  const esRechazada = cancellationStatus === "rejected" || cancellationStatus === "expired";
  const esPendiente = cancellationStatus === "pending" || cancellationStatus === "verifying";
  const esAceptada = cancellationStatus === "accepted" || (invoiceStatus === "canceled" && cancellationStatus === "none");

  if (esRechazada) {
    await supabase
      .from("factura_notas_credito")
      .update({ cancellation_status: cancellationStatus, cancelacion_solicitada_en: null, cancelacion_vence_en: null })
      .eq("id", body.nota_credito_id);
    await registrarBitacoraEdge(supabase, {
      organizationId: nc.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_nc_cancelacion_rechazada",
      entidadId: body.nota_credito_id,
      detalles: { cancellation_status: cancellationStatus, motivo: body.motivo },
    });
    return jsonResponse({
      ok: false,
      cancellation_status: cancellationStatus,
      message: cancellationStatus === "expired"
        ? "El plazo de 72 h expiró sin respuesta del receptor. Reintenta la solicitud."
        : "El receptor rechazó la cancelación desde su Buzón Tributario.",
    }, 409);
  }

  if (esPendiente) {
    const { data: vence } = await supabase.rpc("calc_cancelacion_vence", { p_solicitada: nowIso });
    const { error: pendErr } = await supabase
      .from("factura_notas_credito")
      .update({
        cancellation_status: cancellationStatus,
        cancelacion_motivo: body.motivo,
        cancelacion_solicitada_en: nowIso,
        cancelacion_vence_en: vence ?? null,
      })
      .eq("id", body.nota_credito_id);
    if (pendErr) return jsonResponse({ error: "db_update_failed", detail: pendErr.message }, 500);
    await registrarBitacoraEdge(supabase, {
      organizationId: nc.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_nc_cancelacion_solicitada",
      entidadId: body.nota_credito_id,
      detalles: { motivo: body.motivo, cancellation_status: cancellationStatus, vence_en: vence ?? null },
    });
    return jsonResponse({
      ok: true,
      pending: true,
      cancellation_status: cancellationStatus,
      vence_en: vence ?? null,
      message: "Cancelación enviada al SAT. El receptor tiene hasta 72 h hábiles para aceptar o rechazar (silencio positivo).",
    });
  }

  if (!esAceptada) {
    await registrarBitacoraEdge(supabase, {
      organizationId: nc.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_nc_cancelacion_estado_desconocido",
      entidadId: body.nota_credito_id,
      detalles: { cancellation_status: cancellationStatus, invoice_status: invoiceStatus },
    });
    return jsonResponse({
      ok: false,
      cancellation_status: cancellationStatus,
      message: `FacturApi devolvió un estado inesperado: ${cancellationStatus || invoiceStatus}.`,
    }, 502);
  }

  // Aceptada (inmediata o silencio positivo ya resuelto por FacturAPI).
  const { error: updErr } = await supabase
    .from("factura_notas_credito")
    .update({
      estado: "Cancelada",
      cancellation_status: "accepted",
      cancelacion_motivo: body.motivo,
      cancelado_en: nowIso,
      cancelacion_solicitada_en: nowIso,
    })
    .eq("id", body.nota_credito_id);
  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);

  await registrarBitacoraEdge(supabase, {
    organizationId: nc.organization_id,
    usuarioId: userData.user.id,
    usuarioEmail: userData.user.email,
    modulo: "facturacion",
    accion: "facturapi_nc_cancelada",
    entidadId: body.nota_credito_id,
    detalles: { motivo: body.motivo, sustituye_uuid: body.sustituye_uuid ?? null, cancellation_status: "accepted" },
  });

  return jsonResponse({ ok: true, status: cancelResp.status ?? "canceled", cancellation_status: "accepted" });
}));
