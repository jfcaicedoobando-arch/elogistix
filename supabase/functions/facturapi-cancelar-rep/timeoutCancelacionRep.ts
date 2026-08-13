/**
 * Ola 12 · R3EF-01 (espejo de REF-01 en facturas): en la rama 504 el pago
 * quedaba con `rep_cancellation_status` NULL/'none' y el cron (barre
 * `pending`/`verifying` sobre pagos_factura, entrada.ts:75-84) nunca lo
 * adoptaba. Lo marcamos `verifying` sin pisar una solicitud ya en curso.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";

export async function marcarTimeoutCancelacionRep(params: {
  supabase: SupabaseClient;
  pagoId: string;
  organizationId: string;
  usuarioId: string;
  usuarioEmail?: string;
  motivo?: string;
  op: string;
  timeoutMs: number;
}): Promise<void> {
  const { supabase, pagoId, motivo } = params;
  // pagos_factura no tiene `rep_cancelacion_solicitada_en`; el guard es no
  // pisar un estatus ya activo (pending/verifying/accepted).
  await supabase
    .from("pagos_factura")
    .update({
      rep_cancellation_status: "verifying",
      rep_motivo_cancel: motivo ?? null,
    })
    .eq("id", pagoId)
    .or("rep_cancellation_status.is.null,rep_cancellation_status.eq.none");

  await registrarBitacoraEdge(supabase, {
    organizationId: params.organizationId,
    usuarioId: params.usuarioId,
    usuarioEmail: params.usuarioEmail,
    modulo: "facturacion",
    accion: "facturapi_rep_cancelar_timeout",
    entidadId: pagoId,
    detalles: { op: params.op, timeout_ms: params.timeoutMs },
  });
}
