/**
 * REF-01: manejo del timeout de `invoices.cancel`.
 *
 * En la rama 504 la fila local quedaba en `cancellation_status='none'`, así que
 * el cron `facturapi-reconciliar-cancelaciones` (que sólo barre
 * `pending`/`verifying`) nunca la adoptaba: si Facturapi sí procesó la
 * cancelación y la respuesta se perdió, la factura quedaba vigente localmente
 * para siempre. Aquí la marcamos `verifying` + bitácora, en paridad con
 * `facturapi-cancelar-rep` y `facturapi-cancelar-nota-credito`.
 *
 * v13.821.6 — El helper ahora informa si el estado `verifying` quedó realmente
 * persistido. Con `verifying` en la base, el timeout es un "resultado incierto
 * ya registrado" (respuesta 202 y el cron/`Verificar estatus` resuelven), no un
 * fallo. Si NO se pudo persistir, el caller debe responder error 5xx observable
 * porque nadie reconciliará la factura.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";

/** Estados que garantizan que el cron de reconciliación adoptará la factura. */
const ESTADOS_RECONCILIABLES = ["pending", "verifying"];

export async function marcarTimeoutCancelacion(params: {
  supabase: SupabaseClient;
  facturaId: string;
  organizationId: string;
  usuarioId: string;
  usuarioEmail?: string;
  motivo: string;
  op: string;
  timeoutMs: number;
}): Promise<{ persisted: boolean; cancellationStatus: string }> {
  const { supabase, facturaId, motivo } = params;
  // El guard `.is("cancelacion_solicitada_en", null)` evita pisar una solicitud
  // de cancelación previa que ya esté en curso.
  const { data: actualizadas } = await supabase
    .from("facturas")
    .update({
      cancellation_status: "verifying",
      cancelacion_motivo: motivo,
      cancelacion_solicitada_en: new Date().toISOString(),
    })
    .eq("id", facturaId)
    .is("cancelacion_solicitada_en", null)
    .select("id, cancellation_status");

  let persisted = Array.isArray(actualizadas) && actualizadas.length > 0;
  let cancellationStatus = persisted ? "verifying" : "none";

  if (!persisted) {
    // 0 filas: o ya había una solicitud en curso (perfecto, el cron la barre)
    // o el update falló. Leemos el estado real para no mentirle al cliente.
    const { data: fila } = await supabase
      .from("facturas")
      .select("cancellation_status")
      .eq("id", facturaId)
      .maybeSingle();
    cancellationStatus = ((fila?.cancellation_status as string | null) ?? "none").toLowerCase();
    persisted = ESTADOS_RECONCILIABLES.includes(cancellationStatus);
  }

  await registrarBitacoraEdge(supabase, {
    organizationId: params.organizationId,
    usuarioId: params.usuarioId,
    usuarioEmail: params.usuarioEmail,
    modulo: "facturacion",
    accion: "facturapi_cancelar_timeout",
    entidadId: facturaId,
    detalles: {
      op: params.op,
      timeout_ms: params.timeoutMs,
      motivo,
      persisted,
      cancellation_status: cancellationStatus,
    },
  });

  return { persisted, cancellationStatus };
}
