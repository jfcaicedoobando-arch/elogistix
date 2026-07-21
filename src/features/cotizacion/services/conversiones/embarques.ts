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
 *
 * @deprecated Fase S.4: usar `crearEmbarqueBorradorConDecision` para pasar
 *   la decisión de revalidación explícitamente. Este wrapper delega asumiendo
 *   `decision='sin_cambios'` y la BD sigue bloqueando si la tarifa cambió.
 */
export async function crearEmbarqueBorradorDesdeCotizacion(cotizacionId: string): Promise<string> {
  return crearEmbarqueBorradorConDecision({ cotizacionId, decision: "sin_cambios" });
}

export type DecisionRevalidacion =
  | "sin_cambios"
  | "refrescada"
  | "mantenida_por_operaciones"
  | "sustituida"
  | "reaprobada_ventas";

export interface CrearBorradorInput {
  cotizacionId: string;
  decision: DecisionRevalidacion;
  tarifaAplicada?: string | null;
  delta?: Record<string, unknown> | null;
}

/**
 * Fase S.4 — API estricta para conversión cotización→embarque.
 * Exige `decision` explícita para que la observabilidad y la bitácora reciban
 * la razón por la que la tarifa se mantiene/refresca/sustituye/reaprueba.
 * - `sin_cambios` → RPC 1-arg (BD refuerza que la tarifa realmente no cambió).
 * - otras → RPC 4-arg que registra la decisión en `embarques.tarifa_decision`.
 */
export async function crearEmbarqueBorradorConDecision(input: CrearBorradorInput): Promise<string> {
  const { cotizacionId, decision } = input;
  const { data: cot, error: errCot } = await supabase
    .from("cotizaciones")
    .select("tipo_documento")
    .eq("id", cotizacionId)
    .maybeSingle();
  if (errCot) throw errCot;
  if (cot?.tipo_documento === "informativa") {
    throw new Error("Las cotizaciones informativas (tarifarios) no pueden convertirse a embarques");
  }
  if (decision === "sin_cambios") {
    await assertTarifaSinCambios(cotizacionId);
  }
  const rpc = decision === "sin_cambios"
    ? supabase.rpc("crear_embarque_borrador_desde_cotizacion", { p_cotizacion_id: cotizacionId })
    : supabase.rpc("crear_embarque_borrador_desde_cotizacion", {
        p_cotizacion_id: cotizacionId,
        p_decision: decision,
        p_tarifa_aplicada: input.tarifaAplicada ?? null,
        p_delta: input.delta ?? null,
      } as never);
  const { data, error } = await rpc;
  if (error) {
    const msg = typeof error.message === "string" ? error.message : "";
    if (/LC_TARIFA_REQUIERE_REVALIDACION/.test(msg)) {
      const r = await revalidarTarifa(cotizacionId).catch(() => null);
      if (r) throw new RevalidacionRequeridaError(r);
    }
    if (/LC_COT_ELIMINADA/.test(msg)) {
      throw new Error("Esta cotización fue eliminada y no puede convertirse en embarque.");
    }
    if (/LC_COT_ESTADO_INVALIDO/.test(msg)) {
      throw new Error("Solo se pueden convertir cotizaciones en estado Aceptada o En operación.");
    }
    if (/LC_COT_SIN_CLIENTE/.test(msg)) {
      throw new Error("Convierte el prospecto a cliente antes de crear el borrador de embarque.");
    }
    if (/LC_COT_NO_ENCONTRADA/.test(msg)) {
      throw new Error("La cotización no existe o fue eliminada.");
    }
    if (/LC_NO_AUTORIZADO/.test(msg)) {
      throw new Error("No tienes permisos para crear un borrador desde esta cotización.");
    }
    throw error;
  }
  if (!data) throw new Error("La función no devolvió un embarque");
  return data as string;
}


