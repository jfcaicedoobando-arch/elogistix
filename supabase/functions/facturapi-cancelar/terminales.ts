/**
 * Manejadores de los outcomes terminales de FacturApi.invoices.cancel:
 * rechazada / pendiente / aceptada. Extraídos para adelgazar el handler
 * y mantener `max-lines-per-function` bajo 200.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";
import { descargarAcuseCancelacion } from "./descargarAcuse.ts";

interface CtxBase {
  supabase: SupabaseClient;
  facturaId: string;
  organizationId: string;
  usuarioId: string;
  usuarioEmail?: string;
  motivo: string;
  esSustitucion: boolean;
  sustituidaPorFacturaId: string | null;
}

export async function handleRechazada(ctx: CtxBase & { cancellationStatus: string }): Promise<Response> {
  await registrarBitacoraEdge(ctx.supabase, {
    organizationId: ctx.organizationId,
    usuarioId: ctx.usuarioId,
    usuarioEmail: ctx.usuarioEmail,
    modulo: "facturacion",
    accion: "facturapi_cancelacion_rechazada",
    entidadId: ctx.facturaId,
    detalles: { cancellation_status: ctx.cancellationStatus },
  });
  await ctx.supabase.from("facturas")
    .update({ cancellation_status: ctx.cancellationStatus })
    .eq("id", ctx.facturaId);
  return jsonResponse({
    ok: false,
    cancellation_status: ctx.cancellationStatus,
    message: ctx.cancellationStatus === "expired"
      ? "El plazo de 72 h expiró sin respuesta del receptor. Reintenta la solicitud."
      : "El receptor rechazó la cancelación desde su Buzón Tributario.",
  }, 409);
}

export async function handlePendiente(ctx: CtxBase & { cancellationStatus: string; nowIso: string }): Promise<Response> {
  const { data: vence } = await ctx.supabase.rpc("calc_cancelacion_vence", { p_solicitada: ctx.nowIso });
  const pendingPatch: Record<string, unknown> = {
    cancellation_status: ctx.cancellationStatus,
    cancelacion_motivo: ctx.motivo,
    cancelacion_solicitada_en: ctx.nowIso,
    cancelacion_vence_en: vence ?? null,
  };
  if (ctx.esSustitucion) pendingPatch.sustituida_por = ctx.sustituidaPorFacturaId;

  const { error: updErr } = await ctx.supabase.from("facturas").update(pendingPatch).eq("id", ctx.facturaId);
  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);

  await registrarBitacoraEdge(ctx.supabase, {
    organizationId: ctx.organizationId,
    usuarioId: ctx.usuarioId,
    usuarioEmail: ctx.usuarioEmail,
    modulo: "facturacion",
    accion: "facturapi_cancelacion_solicitada",
    entidadId: ctx.facturaId,
    detalles: {
      motivo: ctx.motivo,
      cancellation_status: ctx.cancellationStatus,
      sustituida_por_factura_id: ctx.sustituidaPorFacturaId,
      vence_en: vence ?? null,
    },
  });

  return jsonResponse({
    ok: true,
    pending: true,
    cancellation_status: ctx.cancellationStatus,
    vence_en: vence ?? null,
    message: "Cancelación enviada al SAT. El receptor tiene hasta 72 h hábiles para aceptar o rechazar (silencio positivo).",
  });
}

export async function handleAceptada(ctx: CtxBase & {
  nowIso: string;
  facturapiId: string;
  apiKey: string;
  sustituyeUuid?: string;
  cancelStatusHint?: string;
}): Promise<Response> {
  const acuse = await descargarAcuseCancelacion(ctx.facturapiId, ctx.apiKey);

  // El cierre de estado (Cancelada/Sustituida) + factura_embarques + proforma
  // vive en la RPC compartida con facturapi-webhook; aquí sólo se persisten
  // los campos propios del acuse descargado de forma síncrona.
  const { data: cierre, error: rpcErr } = await ctx.supabase.rpc(
    "cerrar_cancelacion_factura_facturapi",
    {
      p_factura_id: ctx.facturaId,
      p_sustituida_por_factura_id: ctx.esSustitucion ? ctx.sustituidaPorFacturaId : null,
      p_motivo: ctx.motivo,
    },
  );
  if (rpcErr) return jsonResponse({ error: "cerrar_cancelacion_failed", detail: rpcErr.message }, 500);

  const { error: acuseErr } = await ctx.supabase
    .from("facturas")
    .update({
      acuse_cancelacion_xml: acuse.xml,
      acuse_cancelacion_fecha: acuse.xml ? ctx.nowIso : null,
      acuse_cancelacion_status: acuse.status,
    })
    .eq("id", ctx.facturaId);
  if (acuseErr) return jsonResponse({ error: "db_update_failed", detail: acuseErr.message }, 500);

  await registrarBitacoraEdge(ctx.supabase, {
    organizationId: ctx.organizationId,
    usuarioId: ctx.usuarioId,
    usuarioEmail: ctx.usuarioEmail,
    modulo: "facturacion",
    accion: ctx.esSustitucion ? "facturapi_sustituida" : "facturapi_cancelada",
    entidadId: ctx.facturaId,
    detalles: {
      motivo: ctx.motivo,
      cancellation_status: "accepted",
      sustituye_uuid: ctx.sustituyeUuid ?? null,
      sustituida_por_factura_id: ctx.sustituidaPorFacturaId,
      cierre,
    },
  });

  return jsonResponse({
    ok: true,
    status: ctx.cancelStatusHint ?? "canceled",
    cancellation_status: "accepted",
    sustituida: ctx.esSustitucion,
    acuse_status: acuse.status,
    acuse_guardado: !!acuse.xml,
  });
}

export async function handleEstadoDesconocido(ctx: CtxBase & { cancellationStatus: string; invoiceStatus: string }): Promise<Response> {
  await registrarBitacoraEdge(ctx.supabase, {
    organizationId: ctx.organizationId,
    usuarioId: ctx.usuarioId,
    modulo: "facturacion",
    accion: "facturapi_cancelacion_estado_desconocido",
    entidadId: ctx.facturaId,
    detalles: { cancellation_status: ctx.cancellationStatus, invoice_status: ctx.invoiceStatus },
  });
  return jsonResponse({
    ok: false,
    cancellation_status: ctx.cancellationStatus,
    message: `FacturApi devolvió un estado inesperado: ${ctx.cancellationStatus || ctx.invoiceStatus}.`,
  }, 502);
}
