/**
 * Saneo del patch que un evento de FacturAPI aplica a `facturas`.
 * Extraído de `index.ts` (Power of 10: complejidad y líneas por archivo); el
 * comportamiento es idéntico al previo.
 */
import { jsonResponse } from "../_shared/response.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type SB = SupabaseClient;

interface FacturaLocalMin {
  id: string;
  estado?: string | null;
  sustituida_por?: string | null;
  cancellation_status?: string | null;
}

/** Estados en los que un evento `valid` tardío sí puede fijar "Emitida". */
const ESTADOS_HASTA_EMISION = new Set(["Borrador", "Por timbrar", "Emitida"]);

export function sanearPatchFactura(
  mapped: { patch: Record<string, unknown>; preserva_sustituida?: boolean },
  factura: FacturaLocalMin,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { ...mapped.patch };

  // Si el evento cancela pero la factura fue sustitución, NO sobrescribimos
  // `estado` — el cron de reconciliación lo fija a "Sustituida" al descargar
  // el acuse. Sí conservamos el resto del patch.
  if (mapped.preserva_sustituida && (factura.estado === "Sustituida" || factura.sustituida_por)) {
    delete patch.estado;
  }

  // Ola 4 · N3: un evento `valid` tardío (re-notificación de FacturAPI) no
  // debe regresar a "Emitida" una factura que ya avanzó en su ciclo de vida.
  if (patch.estado === "Emitida" && !ESTADOS_HASTA_EMISION.has(factura.estado ?? "")) {
    delete patch.estado;
  }

  // EF-06: un cancellation_status_updated(pending/verifying) retrasado no debe
  // regresar una cancelación ya aceptada (retries/reordenamiento de FacturAPI).
  if (
    factura.cancellation_status === "accepted" &&
    typeof patch.cancellation_status === "string" &&
    patch.cancellation_status !== "accepted"
  ) {
    delete patch.cancellation_status;
    delete patch.cancelacion_solicitada_en;
    delete patch.cancelacion_vence_en;
  }

  return patch;
}

/**
 * El cierre de una cancelación aceptada vive en la RPC compartida con
 * facturapi-cancelar; NO se persiste el patch crudo con
 * `cancellation_status=accepted` para no duplicar/desincronizar la lógica.
 * Devuelve una `Response` sólo si la RPC falló.
 */
export async function cerrarCancelacionSiAceptada(
  supabase: SB, patch: Record<string, unknown>, facturaId: string,
): Promise<Response | null> {
  if (patch.cancellation_status !== "accepted") return null;
  const { error: rpcErr } = await supabase.rpc("cerrar_cancelacion_factura_facturapi", {
    p_factura_id: facturaId,
  });
  if (rpcErr) return jsonResponse({ error: "cerrar_cancelacion_failed", detail: rpcErr.message }, 500);
  for (const k of [
    "estado", "cancellation_status", "cancelado_en",
    "cancelacion_solicitada_en", "cancelacion_vence_en",
  ]) delete patch[k];
  return null;
}

/**
 * P0 correctivo — escritura con CAS sobre la columna de claim.
 *
 * Un webhook tardío del intento viejo no debe pisar una fila que ya fue
 * liberada y recapturada por un intento nuevo: la actualización sólo procede si
 * la columna de claim sigue teniendo el valor con el que localizamos la fila.
 */
export async function aplicarPatchConCas(args: {
  supabase: SB;
  tabla: string;
  id: string;
  claimCol: string;
  claimEsperado: string | null;
  patch: Record<string, unknown>;
}): Promise<Response | null> {
  let q = args.supabase.from(args.tabla).update(args.patch).eq("id", args.id);
  if (args.claimEsperado !== null) q = q.eq(args.claimCol, args.claimEsperado);
  const { data, error } = await q.select("id");
  if (error) return jsonResponse({ error: "db_update_failed", detail: error.message }, 500);
  const filas = Array.isArray(data) ? data.length : data ? 1 : 0;
  if (filas === 0) {
    // La fila cambió de dueño (liberada/recapturada): ignorar el evento viejo.
    return jsonResponse({ ok: true, ignored: "claim_cambiado" });
  }
  return null;
}
