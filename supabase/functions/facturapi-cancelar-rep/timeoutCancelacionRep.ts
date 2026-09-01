/**
 * Ola 12 · R3EF-01 (espejo de REF-01 en facturas): en la rama 504 el pago
 * quedaba con `rep_cancellation_status` NULL/'none' y el cron (barre
 * `pending`/`verifying` sobre pagos_factura, entrada.ts:75-84) nunca lo
 * adoptaba. Lo marcamos `verifying` sin pisar una solicitud ya en curso.
 *
 * v13.821.6 (P1-2) — mismo contrato que `facturapi-cancelar/timeoutCancelacion.ts`:
 * el helper informa si `verifying` quedó realmente persistido (`.select()`
 * tras el `.update()`). Con `verifying` en la base el timeout es un
 * "resultado incierto ya registrado" (202, el cron/"Actualizar estado"
 * resuelven); si NO se pudo persistir el caller debe responder 5xx porque
 * nadie reconciliará el pago.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";

/** Estados que garantizan que el cron de reconciliación adoptará el pago. */
const ESTADOS_RECONCILIABLES = ["pending", "verifying"];

export async function marcarTimeoutCancelacionRep(params: {
  supabase: SupabaseClient;
  pagoId: string;
  organizationId: string;
  usuarioId: string;
  usuarioEmail?: string;
  motivo?: string;
  op: string;
  timeoutMs: number;
}): Promise<{ persisted: boolean; cancellationStatus: string }> {
  const { supabase, pagoId, motivo } = params;
  // pagos_factura no tiene `rep_cancelacion_solicitada_en`; el guard es no
  // pisar un estatus ya activo (pending/verifying/accepted).
  const { data: actualizadas } = await supabase
    .from("pagos_factura")
    .update({
      rep_cancellation_status: "verifying",
      rep_motivo_cancel: motivo ?? null,
    })
    .eq("id", pagoId)
    .or("rep_cancellation_status.is.null,rep_cancellation_status.eq.none")
    .select("id, rep_cancellation_status");

  let persisted = Array.isArray(actualizadas) && actualizadas.length > 0;
  let cancellationStatus = persisted ? "verifying" : "none";

  if (!persisted) {
    // 0 filas: o ya había una solicitud en curso (perfecto, el cron la barre)
    // o el update falló. Leemos el estado real para no mentirle al cliente.
    const { data: fila } = await supabase
      .from("pagos_factura")
      .select("rep_cancellation_status")
      .eq("id", pagoId)
      .maybeSingle();
    cancellationStatus = ((fila?.rep_cancellation_status as string | null) ?? "none").toLowerCase();
    persisted = ESTADOS_RECONCILIABLES.includes(cancellationStatus);
  }

  await registrarBitacoraEdge(supabase, {
    organizationId: params.organizationId,
    usuarioId: params.usuarioId,
    usuarioEmail: params.usuarioEmail,
    modulo: "facturacion",
    accion: "facturapi_rep_cancelar_timeout",
    entidadId: pagoId,
    detalles: {
      op: params.op,
      timeout_ms: params.timeoutMs,
      motivo: motivo ?? null,
      persisted,
      cancellation_status: cancellationStatus,
    },
  });

  return { persisted, cancellationStatus };
}
