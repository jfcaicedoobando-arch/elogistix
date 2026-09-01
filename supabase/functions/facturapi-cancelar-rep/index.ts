/**
 * facturapi-cancelar-rep — Cancela un REP (Complemento de Pagos) emitido en Facturapi.
 *
 * Entrada: { pago_id: string, motivo: '01'|'02'|'03'|'04', sustituye_uuid?: string }
 * v13.91.0
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";

import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { authorizeOrgRole, ROLES_COBRANZA_FISCAL } from "../_shared/auth.ts";
import { getFacturapiClient, describeFacturapiError, withFacturapiTimeout, FacturapiTimeoutError, FACTURAPI_CANCEL_TIMEOUT_MS } from "../_shared/facturapiClient.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse, makeJson } from "../_shared/response.ts";
import { marcarTimeoutCancelacionRep } from "./timeoutCancelacionRep.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Compat legacy `FACTURAPI_KEY` — multi-tenant resuelto vía SDK (v13.136.4).
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

const MOTIVOS_VALIDOS = new Set(["01", "02", "03", "04"]);

// Ola 13 · R4P-01 (retiro): se retiró la bandera de sustitución 01 del REP
// archivado — el SAT no admite re-cancelar un CFDI cancelado. La trazabilidad
// del REP archivado la mantiene facturapi-emitir-rep (claimRep) y el XML del
// REP nuevo.
interface ReqBody { pago_id?: string; motivo?: string; sustituye_uuid?: string }

// eslint-disable-next-line complexity
Deno.serve(wrapEdgeHandler("facturapi-cancelar-rep", async (req) => {
  // EF-10: endpoints con JWT usan CORS de whitelist (guía _shared/cors.ts).
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const json = makeJson(req);
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
    .select("id, organization_id, facturapi_rep_id, estado_rep, uuid_rep, rep_cancellation_status")
    .eq("id", body.pago_id)
    .maybeSingle();
  if (pErr || !pago) return json({ error: "pago_not_found" }, 404);
  if (!pago.facturapi_rep_id) return json({ error: "no_timbrado_rep" }, 409);
  if (pago.estado_rep === "Cancelado") return json({ error: "ya_cancelado" }, 409);
  if (!(await authorizeOrgRole(supabase, userData.user.id, pago.organization_id, ROLES_COBRANZA_FISCAL))) {
    return json({ error: "forbidden" }, 403);
  }
  // Idempotencia: una pantalla desactualizada puede permitir un segundo clic.
  // No se vuelve a llamar al proveedor fiscal ni se reporta como error.
  if (["pending", "verifying"].includes((pago.rep_cancellation_status ?? "").toLowerCase())) {
    return json({
      ok: true,
      pending: true,
      cancellation_status: pago.rep_cancellation_status,
      message: "La solicitud de cancelación del REP ya está en verificación ante el SAT.",
    });
  }

  // Ola 4 · N5: FacturAPI espera el facturapi_id (ObjectId) del REP
  // sustituto en `substitution`, NO el UUID SAT (mismo patrón que
  // resolveSustitutaSnapshot de facturapi-cancelar). La UI captura el UUID;
  // aquí lo resolvemos al REP timbrado de ESTA organización.
  let sustituyeFacturapiId: string | undefined;
  const objetivoFacturapiId: string = pago.facturapi_rep_id as string;
  if (body.motivo === "01") {
    const { data: sustituto } = await supabase
      .from("pagos_factura")
      .select("id, facturapi_rep_id")
      .eq("organization_id", pago.organization_id)
      .eq("uuid_rep", body.sustituye_uuid!)
      .maybeSingle();
    if (!sustituto?.facturapi_rep_id) {
      return json({
        error: "sustituto_no_encontrado",
        message: "No hay un REP timbrado con ese UUID en esta organización. Timbra primero el REP sustituto.",
      }, 422);
    }
    sustituyeFacturapiId = sustituto.facturapi_rep_id as string;
  }

  const resolved = await getFacturapiClient(supabase, pago.organization_id);
  if (!resolved.ok) return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const facturapi = resolved.data.client;

  interface FapiCancelResponse { status?: string; cancellation_status?: string }
  let cancelResp: FapiCancelResponse;
  try {
    // Ola 4 · N5: `substitution` lleva el ObjectId del sustituto, no el UUID.
    const cancelPayload: { motive: string; substitution?: string } = { motive: body.motivo };
    if (sustituyeFacturapiId) cancelPayload.substitution = sustituyeFacturapiId;
    // EF-05: timeout defensivo — el webhook/cron reconcilian el estado real.
    cancelResp = await withFacturapiTimeout(
      "invoices.cancel",
      facturapi.invoices.cancel(objetivoFacturapiId, cancelPayload),
      FACTURAPI_CANCEL_TIMEOUT_MS,
    ) as FapiCancelResponse;
  } catch (err) {
    if (err instanceof FacturapiTimeoutError) {
      // R3EF-01: marcar verifying para que el cron adopte la fila (patrón REF-01).
      const marca = await marcarTimeoutCancelacionRep({
        supabase,
        pagoId: pago.id,
        organizationId: pago.organization_id,
        usuarioId: userData.user.id,
        usuarioEmail: userData.user.email,
        motivo: body.motivo,
        op: err.op,
        timeoutMs: err.timeoutMs,
      });
      // v13.821.6 (P1-2) — Si `verifying` quedó persistido, la solicitud está
      // ACEPTADA con resultado incierto: el cron y "Actualizar estado" la
      // resuelven. Responder 504 comunicaba un fallo definitivo e invitaba a
      // reintentar, lo cual es inseguro.
      if (marca.persisted) {
        return json(
          {
            ok: true,
            pending: true,
            uncertain: true,
            cancellation_status: marca.cancellationStatus,
            message:
              "La solicitud fue enviada, pero FacturApi tardó en confirmar. Estamos verificando el estado del REP; no vuelvas a cancelarlo.",
          },
          202,
        );
      }
      // Sin `verifying` persistido nadie reconciliará: error observable.
      return json(
        {
          error: "facturapi_timeout",
          op: err.op,
          timeout_ms: err.timeoutMs,
          persisted: false,
          message: err.message,
        },
        504,
      );
    }
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
    return json({ error: "facturapi_error", status, detail, message }, 502);
  }
  // Ola 4 · N5: ramificar por cancellation_status como terminales.ts de
  // facturapi-cancelar — nunca marcar estado_rep='Cancelado' si el SAT dejó
  // la cancelación pendiente o el receptor la rechazó en su Buzón.
  const cancellationStatus = (cancelResp.cancellation_status ?? "none").toLowerCase();
  const invoiceStatus = (cancelResp.status ?? "").toLowerCase();
  const nowIso = new Date().toISOString();
  const esRechazada = cancellationStatus === "rejected" || cancellationStatus === "expired";
  const esPendiente = cancellationStatus === "pending" || cancellationStatus === "verifying";
  const esAceptada = cancellationStatus === "accepted" || (invoiceStatus === "canceled" && cancellationStatus === "none");

  if (esRechazada) {
    await supabase
      .from("pagos_factura")
      .update({ rep_cancellation_status: cancellationStatus })
      .eq("id", pago.id);
    await registrarBitacoraEdge(supabase, {
      organizationId: pago.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_rep_cancelacion_rechazada",
      entidadId: pago.id,
      detalles: { cancellation_status: cancellationStatus, motivo: body.motivo },
    });
    return json({
      ok: false,
      cancellation_status: cancellationStatus,
      message: cancellationStatus === "expired"
        ? "El plazo de 72 h expiró sin respuesta del receptor. Reintenta la solicitud."
        : "El receptor rechazó la cancelación del REP desde su Buzón Tributario.",
    }, 409);
  }

  if (esPendiente) {
    const { error: pendErr } = await supabase
      .from("pagos_factura")
      .update({ rep_cancellation_status: cancellationStatus, rep_motivo_cancel: body.motivo })
      .eq("id", pago.id);
    if (pendErr) return json({ error: "db_update_failed", detail: pendErr.message }, 500);
    await registrarBitacoraEdge(supabase, {
      organizationId: pago.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_rep_cancelacion_solicitada",
      entidadId: pago.id,
      detalles: { motivo: body.motivo, cancellation_status: cancellationStatus },
    });
    return json({
      ok: true,
      pending: true,
      cancellation_status: cancellationStatus,
      message: "Cancelación del REP enviada al SAT. El receptor tiene hasta 72 h hábiles para aceptar o rechazar (silencio positivo).",
    });
  }

  if (!esAceptada) {
    await registrarBitacoraEdge(supabase, {
      organizationId: pago.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_rep_cancelacion_estado_desconocido",
      entidadId: pago.id,
      detalles: { cancellation_status: cancellationStatus, invoice_status: invoiceStatus },
    });
    return json({
      ok: false,
      cancellation_status: cancellationStatus,
      message: `FacturApi devolvió un estado inesperado: ${cancellationStatus || invoiceStatus}.`,
    }, 502);
  }

  // Aceptada (inmediata o silencio positivo ya resuelto por FacturAPI).
  const { error: updErr } = await supabase
    .from("pagos_factura")
    .update({
      estado_rep: "Cancelado",
      rep_cancellation_status: "accepted",
      rep_cancelado_en: nowIso,
      rep_motivo_cancel: body.motivo,
    })
    .eq("id", pago.id);
  if (updErr) return json({ error: "db_update_failed", detail: updErr.message }, 500);

  await registrarBitacoraEdge(supabase, {
    organizationId: pago.organization_id,
    usuarioId: userData.user.id,
    usuarioEmail: userData.user.email,
    modulo: "facturacion",
    accion: "facturapi_rep_cancelado",
    entidadId: pago.id,
    detalles: { motivo: body.motivo, sustituye_uuid: body.sustituye_uuid ?? null, cancellation_status: "accepted" },
  });

  return json({ ok: true, status: cancelResp.status ?? "canceled", cancellation_status: "accepted" });
}));
