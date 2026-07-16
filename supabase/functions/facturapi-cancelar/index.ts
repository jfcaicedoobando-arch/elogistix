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

import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { authorizeOrgMembership } from "../_shared/auth.ts";
import { getFacturapiClient, describeFacturapiError } from "../_shared/facturapiClient.ts";
import { descargarAcuseCancelacion } from "./descargarAcuse.ts";
import { validateCancelacionInput, type CancelacionInput } from "./helpers.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { handleDescargarAcusePdf, handleDescargarAcuseXml } from "./acuseHandlers.ts";
import { jsonResponse } from "../_shared/response.ts";
import {
  enrichCancelacionErrorMessage,
  resolveSustitutaSnapshot,
  revertirProformasCancelacion,
} from "./cancelacion.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Compat legacy `FACTURAPI_KEY` — multi-tenant resuelto vía SDK (v13.136.4).
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

Deno.serve(wrapEdgeHandler("facturapi-cancelar", async (req) => {
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

  const rawBody = (await req.json().catch(() => ({}))) as CancelacionInput & {
    sustituida_por_factura_id?: string;
    solo_descargar_acuse?: boolean;
    solo_descargar_acuse_pdf?: boolean;
  };

  // Modo "solo descargar acuse PDF": Facturapi expone el acuse SAT en
  // formato PDF (además del XML). Aquí lo streameamos como binario al
  // navegador sin guardarlo en BD (el XML sigue siendo la fuente de verdad).
  if (rawBody.solo_descargar_acuse_pdf === true) {
    if (!rawBody.factura_id) return jsonResponse({ error: "factura_id_required" }, 400);
    return await handleDescargarAcusePdf(supabase, userData.user.id, rawBody.factura_id);
  }

  // Modo "solo descargar acuse": la factura ya se canceló antes y sólo
  // necesitamos volver a preguntarle al SAT por el acuse (útil cuando la
  // primera cancelación quedó con `acuse_cancelacion_status = 'pending'`).
  if (rawBody.solo_descargar_acuse === true) {
    if (!rawBody.factura_id) return jsonResponse({ error: "factura_id_required" }, 400);
    return await handleDescargarAcuseXml(supabase, userData.user.id, rawBody.factura_id);
  }

  // Si viene `sustituida_por_factura_id`, resolver su UUID SAT y su facturapi_id.
  // FacturApi espera el `facturapi_id` (ObjectId) en el parámetro `substitution`,
  // NO el UUID SAT. El UUID SAT sólo lo usamos para bitácora/auditoría.
  let sustituyeUuidResuelto: string | undefined = rawBody.sustituye_uuid;
  let sustituyeFacturapiId: string | undefined;
  const sustituidaPorFacturaId: string | null = rawBody.sustituida_por_factura_id ?? null;
  if (sustituidaPorFacturaId) {
    const snap = await resolveSustitutaSnapshot(supabase, sustituidaPorFacturaId);
    if (!snap.ok) {
      return jsonResponse({ error: "sustituta_sin_uuid", message: "La factura sustituta aún no está timbrada." }, 422);
    }
    sustituyeUuidResuelto = snap.uuid;
    sustituyeFacturapiId = snap.facturapiId;
  }

  const validated = validateCancelacionInput({ ...rawBody, sustituye_uuid: sustituyeUuidResuelto });
  if (!validated.ok) {
    return jsonResponse({ error: validated.error, ...(validated.message ? { message: validated.message } : {}) }, 400);
  }
  const { factura_id, motivo, sustituye_uuid } = validated.data;

  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select("id, facturapi_id, organization_id, estado")
    .eq("id", factura_id)
    .maybeSingle();
  if (fErr || !factura) return jsonResponse({ error: "factura_not_found" }, 404);
  if (!factura.facturapi_id) return jsonResponse({ error: "no_timbrada" }, 409);
  if (!(await authorizeOrgMembership(supabase, userData.user.id, factura.organization_id))) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const resolved = await getFacturapiClient(supabase, factura.organization_id);
  if (!resolved.ok) return jsonResponse({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const facturapi = resolved.data.client;

  // FacturApi devuelve tanto `status` (valid/canceled) como `cancellation_status`
  // (none|verifying|pending|accepted|rejected|expired). El segundo es el que
  // realmente refleja si el SAT ya aceptó la cancelación o si el receptor
  // todavía tiene 72 h para responder (regla 2.7.1.34 RMF).
  interface FapiCancelResponse { status?: string; cancellation_status?: string }
  let cancelResp: FapiCancelResponse;
  try {
    // `substitution` requiere el facturapi_id (ObjectId) de la factura sustituta.
    const cancelPayload: { motive: string; substitution?: string } = { motive: motivo };
    if (sustituyeFacturapiId) cancelPayload.substitution = sustituyeFacturapiId;
    cancelResp = await facturapi.invoices.cancel(
      factura.facturapi_id,
      cancelPayload,
    ) as FapiCancelResponse;
  } catch (err) {
    const { status, detail } = describeFacturapiError(err);
    await registrarBitacoraEdge(supabase, {
      organizationId: factura.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_cancelar_failed",
      entidadId: factura_id,
      detalles: { status, response: detail },
    });
    const rawMessage = (detail && typeof detail === "object" && "message" in (detail as Record<string, unknown>) && typeof (detail as Record<string, unknown>).message === "string") ? (detail as Record<string, string>).message : `FacturApi respondió ${status}`;
    const esNoCancelable = /no cancelable|marcada como no|no puede.*cancel|facturas relacionadas/i.test(rawMessage);
    const esServicioSatCaido = /cancelacionsat no est|servicio.*sat.*no.*disp|sat.*no.*disponible/i.test(rawMessage);
    let message = rawMessage;
    if (esServicioSatCaido) {
      message = "El SAT no está respondiendo en este momento (servicio de cancelación caído del lado del SAT). No es un problema de tu factura ni de tus datos. Espera unos minutos y reintenta.";
    } else if (esNoCancelable) {
      message = `${rawMessage}\n\nEl SAT rechazó la cancelación. Causas comunes:\n• El receptor debe ACEPTAR la cancelación en su Buzón Tributario (CFDIs > $1,000 MXN).\n• Existen complementos de pago (REP) o notas de crédito vinculados: cancélalos primero.\n• El SAT aún no propaga la sustitución: reintenta en 30–60 minutos.`;
    }
    return jsonResponse({ error: "facturapi_error", status, detail, message, transient: esServicioSatCaido }, 502);
  }

  const cancellationStatus = (cancelResp.cancellation_status ?? "none").toLowerCase();
  const invoiceStatus = (cancelResp.status ?? "").toLowerCase();
  const esSustitucion = motivo === "01" && !!sustituidaPorFacturaId;

  // Terminal aceptado = el SAT confirmó cancelación. `status: 'canceled'` sin
  // `cancellation_status` (respuesta antigua o motivo que no requiere ack)
  // también cae aquí.
  const esAceptada = cancellationStatus === "accepted" || (invoiceStatus === "canceled" && cancellationStatus === "none");
  const esPendiente = cancellationStatus === "pending" || cancellationStatus === "verifying";
  const esRechazada = cancellationStatus === "rejected" || cancellationStatus === "expired";

  if (esRechazada) {
    // El SAT rechazó (raro que ocurra en el mismo request, pero se maneja).
    await registrarBitacoraEdge(supabase, {
      organizationId: factura.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_cancelacion_rechazada",
      entidadId: factura_id,
      detalles: { cancellation_status: cancellationStatus },
    });
    await supabase.from("facturas").update({ cancellation_status: cancellationStatus }).eq("id", factura_id);
    return jsonResponse({
      ok: false,
      cancellation_status: cancellationStatus,
      message: cancellationStatus === "expired"
        ? "El plazo de 72 h expiró sin respuesta del receptor. Reintenta la solicitud."
        : "El receptor rechazó la cancelación desde su Buzón Tributario.",
    }, 409);
  }

  const nowIso = new Date().toISOString();

  if (esPendiente) {
    // Aceptación pendiente: NO cambiamos `estado` (sigue Emitida/Timbrada),
    // NO revertimos proformas, NO descargamos acuse todavía. Sólo registramos
    // la solicitud y la fecha estimada de vencimiento (silencio positivo 72 h).
    const { data: vence } = await supabase.rpc("calc_cancelacion_vence", { p_solicitada: nowIso });
    const pendingPatch: Record<string, unknown> = {
      cancellation_status: cancellationStatus,
      cancelacion_motivo: motivo,
      cancelacion_solicitada_en: nowIso,
      cancelacion_vence_en: vence ?? null,
    };
    // Guardar `sustituida_por` desde ya para que el webhook/cron sepa que fue sustitución.
    if (esSustitucion) pendingPatch.sustituida_por = sustituidaPorFacturaId;

    const { error: updErr } = await supabase.from("facturas").update(pendingPatch).eq("id", factura_id);
    if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);

    await registrarBitacoraEdge(supabase, {
      organizationId: factura.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_cancelacion_solicitada",
      entidadId: factura_id,
      detalles: {
        motivo,
        cancellation_status: cancellationStatus,
        sustituida_por_factura_id: sustituidaPorFacturaId,
        vence_en: vence ?? null,
      },
    });

    return jsonResponse({
      ok: true,
      pending: true,
      cancellation_status: cancellationStatus,
      vence_en: vence ?? null,
      message: "Cancelación enviada al SAT. El receptor tiene hasta 72 h hábiles para aceptar o rechazar (silencio positivo).",
    });
  }

  // Camino aceptada (terminal): mantiene el flujo histórico intacto.
  if (!esAceptada) {
    // Estado inesperado — registrar y reportar sin cambiar la factura.
    await registrarBitacoraEdge(supabase, {
      organizationId: factura.organization_id,
      usuarioId: userData.user.id,
      modulo: "facturacion",
      accion: "facturapi_cancelacion_estado_desconocido",
      entidadId: factura_id,
      detalles: { cancellation_status: cancellationStatus, invoice_status: invoiceStatus },
    });
    return jsonResponse({
      ok: false,
      cancellation_status: cancellationStatus,
      message: `FacturApi devolvió un estado inesperado: ${cancellationStatus || invoiceStatus}.`,
    }, 502);
  }

  const acuse = await descargarAcuseCancelacion(factura.facturapi_id!, resolved.data.apiKey);
  const updatePayload: Record<string, unknown> = {
    estado: esSustitucion ? "Sustituida" : "Cancelada",
    cancellation_status: "accepted",
    cancelacion_motivo: motivo,
    cancelado_en: nowIso,
    cancelacion_solicitada_en: nowIso,
    acuse_cancelacion_xml: acuse.xml,
    acuse_cancelacion_fecha: acuse.xml ? nowIso : null,
    acuse_cancelacion_status: acuse.status,
  };
  if (esSustitucion) updatePayload.sustituida_por = sustituidaPorFacturaId;

  const { error: updErr } = await supabase
    .from("facturas")
    .update(updatePayload)
    .eq("id", factura_id);
  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);

  const proformasRevertidas: Array<{ id: string; estado: string }> = [];
  if (!esSustitucion) {
    const { data: proformasLigadas } = await supabase
      .from("proformas")
      .select("id, factura_id, factura_secundaria_id")
      .or(`factura_id.eq.${factura_id},factura_secundaria_id.eq.${factura_id}`);
    for (const pf of proformasLigadas ?? []) {
      const nuevoFacturaId = pf.factura_id === factura_id ? null : pf.factura_id;
      const nuevoFacturaSecId = pf.factura_secundaria_id === factura_id ? null : pf.factura_secundaria_id;
      const ambosNulos = !nuevoFacturaId && !nuevoFacturaSecId;
      const patch: Record<string, unknown> = {
        factura_id: nuevoFacturaId,
        factura_secundaria_id: nuevoFacturaSecId,
      };
      if (ambosNulos) {
        patch.estado_proforma = "pendiente";
        patch.fecha_facturacion = null;
        patch.folio_factura_externa = null;
      }
      const { error: upPfErr } = await supabase.from("proformas").update(patch).eq("id", pf.id);
      if (!upPfErr) proformasRevertidas.push({ id: pf.id, estado: ambosNulos ? "pendiente" : "facturada" });
    }
  }

  await registrarBitacoraEdge(supabase, {
    organizationId: factura.organization_id,
    usuarioId: userData.user.id,
    usuarioEmail: userData.user.email,
    modulo: "facturacion",
    accion: esSustitucion ? "facturapi_sustituida" : "facturapi_cancelada",
    entidadId: factura_id,
    detalles: {
      motivo,
      cancellation_status: "accepted",
      sustituye_uuid: sustituye_uuid ?? null,
      sustituida_por_factura_id: sustituidaPorFacturaId,
      proformas_revertidas: proformasRevertidas,
    },
  });

  return jsonResponse({
    ok: true,
    status: cancelResp.status ?? "canceled",
    cancellation_status: "accepted",
    sustituida: esSustitucion,
    acuse_status: acuse.status,
    acuse_guardado: !!acuse.xml,
  });
}));

