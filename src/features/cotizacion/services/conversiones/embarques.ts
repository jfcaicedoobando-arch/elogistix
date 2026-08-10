/**
 * Cotizaciones — Conversión: Cotización → 1 embarque con N contenedores hijos.
 * Modelo 1↔N (v12.10): cotización con N contenedores genera UN embarque + N hijos.
 *
 * Ola 4 · N17: se eliminó el wrapper duplicado `crearEmbarqueBorradorConDecision`
 * (sin callers) que invocaba la RPC de 4 args con parámetros inexistentes
 * (`p_tarifa_aplicada`/`p_delta` → PGRST202; la firma real es
 * `p_tarifa_id_aplicada`/`p_delta_jsonb`). El flujo con decisión de
 * revalidación vive únicamente en
 * `@/features/cotizacion/services/revalidacion` (`crearEmbarqueBorradorConDecision`),
 * que usa los nombres correctos.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
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

const RPC_ERROR_MAP: ReadonlyArray<[RegExp, string]> = [
  [/LC_COT_ELIMINADA/, "Esta cotización fue eliminada y no puede convertirse en embarque."],
  [/LC_COT_ESTADO_INVALIDO/, "Solo se pueden convertir cotizaciones en estado Aceptada o En operación."],
  [/LC_COT_SIN_CLIENTE/, "Convierte el prospecto a cliente antes de crear el borrador de embarque."],
  [/LC_COT_NO_ENCONTRADA/, "La cotización no existe o fue eliminada."],
  [/LC_NO_AUTORIZADO/, "No tienes permisos para crear un borrador desde esta cotización."],
];

async function mapCrearEmbarqueError(error: { message?: string }, cotizacionId: string): Promise<Error> {
  const msg = typeof error.message === "string" ? error.message : "";
  if (/LC_TARIFA_REQUIERE_REVALIDACION/.test(msg)) {
    const r = await revalidarTarifa(cotizacionId).catch(() => null);
    if (r) return new RevalidacionRequeridaError(r);
  }
  const match = RPC_ERROR_MAP.find(([re]) => re.test(msg));
  return match ? new Error(match[1]) : (error as Error);
}

/**
 * Crea un embarque borrador desde una cotización aceptada usando la RPC 1-arg
 * `crear_embarque_borrador_desde_cotizacion(uuid)` (idempotente: devuelve el
 * embarque existente si la cotización ya tiene uno vinculado). Asume
 * `decision='sin_cambios'` y la BD lo refuerza. Para conversiones con
 * decisión de revalidación (refrescada / mantenida / sustituida / reaprobada)
 * usar `crearEmbarqueBorradorConDecision` de
 * `@/features/cotizacion/services/revalidacion`.
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
  await assertTarifaSinCambios(cotizacionId);
  const { data, error } = await supabase.rpc("crear_embarque_borrador_desde_cotizacion", {
    p_cotizacion_id: cotizacionId,
  });
  if (error) throw await mapCrearEmbarqueError(error, cotizacionId);
  if (!data) throw new Error("La función no devolvió un embarque");
  await registrarActividad({
    modulo: "cotizaciones",
    accion: "convertir_a_embarque",
    entidadId: cotizacionId,
    entidadNombre: data as string,
    detalles: { decision: "sin_cambios" },
  });
  return data as string;
}
