/**
 * REF-01: manejo del timeout de `invoices.cancel`.
 *
 * En la rama 504 la fila local quedaba en `cancellation_status='none'`, así que
 * el cron `facturapi-reconciliar-cancelaciones` (que sólo barre
 * `pending`/`verifying`) nunca la adoptaba: si Facturapi sí procesó la
 * cancelación y la respuesta se perdió, la factura quedaba vigente localmente
 * para siempre. Aquí la marcamos `verifying` + bitácora, en paridad con
 * `facturapi-cancelar-rep` y `facturapi-cancelar-nota-credito`.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";

export async function marcarTimeoutCancelacion(params: {
  supabase: SupabaseClient;
  facturaId: string;
  organizationId: string;
  usuarioId: string;
  usuarioEmail?: string;
  motivo: string;
  op: string;
  timeoutMs: number;
}): Promise<void> {
  const { supabase, facturaId, motivo } = params;
  // El guard `.is("cancelacion_solicitada_en", null)` evita pisar una solicitud
  // de cancelación previa que ya esté en curso.
  await supabase
    .from("facturas")
    .update({
      cancellation_status: "verifying",
      cancelacion_motivo: motivo,
      cancelacion_solicitada_en: new Date().toISOString(),
    })
    .eq("id", facturaId)
    .is("cancelacion_solicitada_en", null);

  await registrarBitacoraEdge(supabase, {
    organizationId: params.organizationId,
    usuarioId: params.usuarioId,
    usuarioEmail: params.usuarioEmail,
    modulo: "facturacion",
    accion: "facturapi_cancelar_timeout",
    entidadId: facturaId,
    detalles: { op: params.op, timeout_ms: params.timeoutMs, motivo },
  });
}
