/**
 * Ramificación por `cancellation_status` (Ola 4 · N4): nunca marcar
 * 'Cancelada' si el SAT dejó la cancelación pendiente o el receptor la
 * rechazó en su Buzón Tributario.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";

export interface FapiCancelResponse {
  status?: string;
  cancellation_status?: string;
}

export interface OutcomeCtx {
  ncId: string;
  organizationId: string;
  usuarioId: string;
  usuarioEmail?: string;
  motivo?: string;
  sustituyeUuid?: string | null;
}

type Detalles = Record<string, unknown>;

function bitacora(supabase: SupabaseClient, ctx: OutcomeCtx, accion: string, detalles: Detalles) {
  return registrarBitacoraEdge(supabase, {
    organizationId: ctx.organizationId,
    usuarioId: ctx.usuarioId,
    usuarioEmail: ctx.usuarioEmail,
    modulo: "facturacion",
    accion,
    entidadId: ctx.ncId,
    detalles,
  });
}

async function rechazada(supabase: SupabaseClient, ctx: OutcomeCtx, estado: string): Promise<Response> {
  await supabase
    .from("factura_notas_credito")
    .update({ cancellation_status: estado, cancelacion_solicitada_en: null, cancelacion_vence_en: null })
    .eq("id", ctx.ncId);
  await bitacora(supabase, ctx, "facturapi_nc_cancelacion_rechazada", {
    cancellation_status: estado,
    motivo: ctx.motivo,
  });
  return jsonResponse({
    ok: false,
    cancellation_status: estado,
    message: estado === "expired"
      ? "El plazo de 72 h expiró sin respuesta del receptor. Reintenta la solicitud."
      : "El receptor rechazó la cancelación desde su Buzón Tributario.",
  }, 409);
}

async function pendiente(
  supabase: SupabaseClient,
  ctx: OutcomeCtx,
  estado: string,
  nowIso: string,
): Promise<Response> {
  const { data: vence } = await supabase.rpc("calc_cancelacion_vence", { p_solicitada: nowIso });
  const { error } = await supabase
    .from("factura_notas_credito")
    .update({
      cancellation_status: estado,
      cancelacion_motivo: ctx.motivo,
      cancelacion_solicitada_en: nowIso,
      cancelacion_vence_en: vence ?? null,
    })
    .eq("id", ctx.ncId);
  if (error) return jsonResponse({ error: "db_update_failed", detail: error.message }, 500);
  await bitacora(supabase, ctx, "facturapi_nc_cancelacion_solicitada", {
    motivo: ctx.motivo,
    cancellation_status: estado,
    vence_en: vence ?? null,
  });
  return jsonResponse({
    ok: true,
    pending: true,
    cancellation_status: estado,
    vence_en: vence ?? null,
    message: "Cancelación enviada al SAT. El receptor tiene hasta 72 h hábiles para aceptar o rechazar (silencio positivo).",
  });
}

async function desconocida(
  supabase: SupabaseClient,
  ctx: OutcomeCtx,
  estado: string,
  invoiceStatus: string,
): Promise<Response> {
  await bitacora(supabase, ctx, "facturapi_nc_cancelacion_estado_desconocido", {
    cancellation_status: estado,
    invoice_status: invoiceStatus,
  });
  return jsonResponse({
    ok: false,
    cancellation_status: estado,
    message: `FacturApi devolvió un estado inesperado: ${estado || invoiceStatus}.`,
  }, 502);
}

async function aceptada(
  supabase: SupabaseClient,
  ctx: OutcomeCtx,
  nowIso: string,
  invoiceStatus?: string,
): Promise<Response> {
  const { error } = await supabase
    .from("factura_notas_credito")
    .update({
      estado: "Cancelada",
      cancellation_status: "accepted",
      cancelacion_motivo: ctx.motivo,
      cancelado_en: nowIso,
      cancelacion_solicitada_en: nowIso,
    })
    .eq("id", ctx.ncId);
  if (error) return jsonResponse({ error: "db_update_failed", detail: error.message }, 500);
  await bitacora(supabase, ctx, "facturapi_nc_cancelada", {
    motivo: ctx.motivo,
    sustituye_uuid: ctx.sustituyeUuid ?? null,
    cancellation_status: "accepted",
  });
  return jsonResponse({ ok: true, status: invoiceStatus ?? "canceled", cancellation_status: "accepted" });
}

export function handleCancelOutcome(
  supabase: SupabaseClient,
  ctx: OutcomeCtx,
  cancelResp: FapiCancelResponse,
): Promise<Response> {
  const estado = (cancelResp.cancellation_status ?? "none").toLowerCase();
  const invoiceStatus = (cancelResp.status ?? "").toLowerCase();
  const nowIso = new Date().toISOString();

  if (estado === "rejected" || estado === "expired") return rechazada(supabase, ctx, estado);
  if (estado === "pending" || estado === "verifying") return pendiente(supabase, ctx, estado, nowIso);
  const esAceptada = estado === "accepted" || (invoiceStatus === "canceled" && estado === "none");
  if (!esAceptada) return desconocida(supabase, ctx, estado, invoiceStatus);
  return aceptada(supabase, ctx, nowIso, cancelResp.status);
}
