/**
 * Ola 12 · R3EF-01 (espejo de REF-01 en facturas): en la rama 504 la NC
 * quedaba en `cancellation_status='none'` y el cron reconciliar-cancelaciones
 * (que barre `pending`/`verifying`, entrada.ts:63-71) nunca la adoptaba.
 * Aquí la marcamos `verifying` con el mismo guard anti-pisado.
 *
 * v13.821.6 (P1-2) — mismo contrato que `facturapi-cancelar/timeoutCancelacion.ts`:
 * el helper informa si `verifying` quedó realmente persistido (`.select()`
 * tras el `.update()`). Persistido ⇒ resultado incierto ya registrado (202);
 * no persistido ⇒ el caller responde 5xx porque nadie reconciliará la NC.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";

/** Estados que garantizan que el cron de reconciliación adoptará la NC. */
const ESTADOS_RECONCILIABLES = ["pending", "verifying"];

export async function marcarTimeoutCancelacionNc(params: {
  supabase: SupabaseClient;
  ncId: string;
  organizationId: string;
  usuarioId: string;
  usuarioEmail?: string;
  motivo?: string;
  op: string;
  timeoutMs: number;
}): Promise<{ persisted: boolean; cancellationStatus: string }> {
  const { supabase, ncId, motivo } = params;
  // El guard `.is("cancelacion_solicitada_en", null)` evita pisar una
  // solicitud de cancelación previa que ya esté en curso.
  const { data: actualizadas } = await supabase
    .from("factura_notas_credito")
    .update({
      cancellation_status: "verifying",
      cancelacion_motivo: motivo ?? null,
      cancelacion_solicitada_en: new Date().toISOString(),
    })
    .eq("id", ncId)
    .is("cancelacion_solicitada_en", null)
    .select("id, cancellation_status");

  let persisted = Array.isArray(actualizadas) && actualizadas.length > 0;
  let cancellationStatus = persisted ? "verifying" : "none";

  if (!persisted) {
    const { data: fila } = await supabase
      .from("factura_notas_credito")
      .select("cancellation_status")
      .eq("id", ncId)
      .maybeSingle();
    cancellationStatus = ((fila?.cancellation_status as string | null) ?? "none").toLowerCase();
    persisted = ESTADOS_RECONCILIABLES.includes(cancellationStatus);
  }

  await registrarBitacoraEdge(supabase, {
    organizationId: params.organizationId,
    usuarioId: params.usuarioId,
    usuarioEmail: params.usuarioEmail,
    modulo: "facturacion",
    accion: "facturapi_nc_cancelar_timeout",
    entidadId: ncId,
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
