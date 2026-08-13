/**
 * Ola 12 · R3EF-01 (espejo de REF-01 en facturas): en la rama 504 la NC
 * quedaba en `cancellation_status='none'` y el cron reconciliar-cancelaciones
 * (que barre `pending`/`verifying`, entrada.ts:63-71) nunca la adoptaba.
 * Aquí la marcamos `verifying` con el mismo guard anti-pisado.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";

export async function marcarTimeoutCancelacionNc(params: {
  supabase: SupabaseClient;
  ncId: string;
  organizationId: string;
  usuarioId: string;
  usuarioEmail?: string;
  motivo?: string;
  op: string;
  timeoutMs: number;
}): Promise<void> {
  const { supabase, ncId, motivo } = params;
  // El guard `.is("cancelacion_solicitada_en", null)` evita pisar una
  // solicitud de cancelación previa que ya esté en curso.
  await supabase
    .from("factura_notas_credito")
    .update({
      cancellation_status: "verifying",
      cancelacion_motivo: motivo ?? null,
      cancelacion_solicitada_en: new Date().toISOString(),
    })
    .eq("id", ncId)
    .is("cancelacion_solicitada_en", null);

  await registrarBitacoraEdge(supabase, {
    organizationId: params.organizationId,
    usuarioId: params.usuarioId,
    usuarioEmail: params.usuarioEmail,
    modulo: "facturacion",
    accion: "facturapi_nc_cancelar_timeout",
    entidadId: ncId,
    detalles: { op: params.op, timeout_ms: params.timeoutMs },
  });
}
