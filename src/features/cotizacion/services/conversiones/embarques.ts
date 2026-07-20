/**
 * Cotizaciones — Conversión: Cotización → 1 embarque con N contenedores hijos.
 * Modelo 1↔N (v12.10): cotización con N contenedores genera UN embarque + N hijos.
 * Costos "Contenedor" se replican por hijo; "BL" se insertan una vez (general).
 * Helpers extraídos a `embarquesHelpers.ts` (12.33.0).
 */
import { supabase } from "@/integrations/supabase/client";
import { revalidarTarifa } from "@/features/cotizacion/services/revalidacion";
import {
  RevalidacionRequeridaError,
  type ResultadoRevalidacion,
} from "@/features/cotizacion/domain/revalidacionTarifa";

/**
 * Fase R.6 (Bug 18): pre-check en cliente. Bloquea la conversión si la tarifa
 * de la cotización cambió, venció o quedó por fuera del umbral. La misma
 * validación está reforzada en BD dentro de la RPC 1-arg
 * `crear_embarque_borrador_desde_cotizacion(uuid)` mediante
 * `enforce_revalidacion_sin_cambios`.
 */
async function assertTarifaSinCambios(cotizacionId: string): Promise<ResultadoRevalidacion> {
  const r = await revalidarTarifa(cotizacionId);
  if (r.severidad !== "sin_cambios") {
    throw new RevalidacionRequeridaError(
      r,
      "La tarifa de la cotización cambió o venció. Usa el flujo de revalidación (Crear embarque) para mantener, refrescar, sustituir o pedir reaprobación antes de generar el embarque.",
    );
  }
  return r;
}


// FIX-07 (v13.303.12) — `convertirCotizacionAEmbarques` (6 awaits sin
// transacción desde el cliente) se eliminó junto con sus helpers
// `insertarCostosEmbarque`/`insertarVentasEmbarque`. Toda conversión pasa
// por `crearEmbarqueBorradorDesdeCotizacion` → RPC transaccional
// `crear_embarque_borrador_desde_cotizacion(uuid)`.


/**
 * Crea un embarque borrador desde una cotización aceptada usando la RPC
 * `crear_embarque_borrador_desde_cotizacion`. Idempotente (devuelve el embarque
 * existente si la cotización ya tiene uno vinculado).
 */
export async function crearEmbarqueBorradorDesdeCotizacion(cotizacionId: string): Promise<string> {
  const { data: cot, error: errCot } = await supabase
    .from("cotizaciones")
    .select("tipo_documento")
    .eq("id", cotizacionId)
    .maybeSingle();
  if (errCot) throw errCot;
  if (cot?.tipo_documento === "informativa") {
    throw new Error("Las cotizaciones informativas (tarifarios) no pueden convertirse a embarques");
  }
  // Fase R.6 (Bug 18): pre-check + mapeo del token `LC_TARIFA_REQUIERE_REVALIDACION`.
  await assertTarifaSinCambios(cotizacionId);
  const { data, error } = await supabase.rpc("crear_embarque_borrador_desde_cotizacion", {
    p_cotizacion_id: cotizacionId,
  });
  if (error) {
    if (typeof error.message === "string" && /LC_TARIFA_REQUIERE_REVALIDACION/.test(error.message)) {
      // La revalidación cambió entre el pre-check y la RPC — rehidratar para el modal.
      const r = await revalidarTarifa(cotizacionId).catch(() => null);
      if (r) throw new RevalidacionRequeridaError(r);
    }
    throw error;
  }
  if (!data) throw new Error("La función no devolvió un embarque");
  return data as string;

}
