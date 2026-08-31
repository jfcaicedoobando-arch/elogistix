/**
 * Mutaciones directas (no-RPC) contra `embarques` / `notas_embarque`.
 * Extraídas de `mutations.ts` en v13.214.1 para mantener ese archivo bajo el
 * límite Power-of-10 de 200 líneas. Barrel de services las re-exporta.
 */
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { notaSchema, parseOrThrow } from "@/lib/validation/mutationSchemas";
import { run } from "@/lib/supabase/response";
import { registrarBitacoraEmbarque } from "./bitacoraEmbarques";

type EmbarqueInsert = TablesInsert<'embarques'>;

/**
 * v13.814.0 (Ola Cotización→Embarque, hallazgo 1): un UPDATE bloqueado por RLS
 * o sobre un id inexistente NO devuelve error en PostgREST — devuelve 0 filas.
 * Sin esta verificación la UI mostraba "guardado" y la bitácora registraba un
 * cambio que nunca ocurrió. Devuelve sólo cuando la fila fue afectada.
 */
async function actualizarEmbarqueVerificado(
  embarqueId: string,
  patch: Partial<EmbarqueInsert>,
): Promise<void> {
  const { data, error } = await supabase
    .from('embarques')
    .update(patch)
    .eq('id', embarqueId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "No se guardaron los cambios del embarque: no tienes permiso o el embarque ya no existe.",
    );
  }
}

export async function actualizarEstadoEmbarque(embarqueId: string, estado: string): Promise<void> {
  await actualizarEmbarqueVerificado(embarqueId, {
    estado: estado as EmbarqueInsert['estado'],
  });
  await registrarBitacoraEmbarque({
    accion: "Actualizó estado de embarque",
    entidadId: embarqueId,
    detalles: { estadoNuevo: estado },
  });
}

/**
 * Actualiza la fecha de llegada real del embarque y avanza el estado a
 * "Arribo" cuando el estado actual lo permite según la máquina de estados de
 * BD (v13.303.22: `En Tránsito → Arribo`, `En Proceso → Arribo`). En estados
 * ya avanzados (`En Aduana`/`Entregado`/`EIR`/`Cerrado`) o comerciales
 * previos, sólo se actualiza `fecha_llegada_real` para evitar
 * `LC_TRANSICION_INVALIDA`. v13.303.22 (antes: avanzaba a `Llegada`, ya
 * deprecado).
 */
const ESTADOS_QUE_AVANZAN_A_ARRIBO = new Set(["En Tránsito", "En Proceso"]);
const ESTADOS_QUE_ADMITEN_LLEGADA = new Set([
  "En Tránsito", "En Proceso", "Arribo", "En Aduana", "Entregado", "EIR",
  "Por liquidar", "Cerrado",
]);

/**
 * v13.320.36 (B-017) — Guardas de negocio para marcar llegada real:
 *   1. No permite fechas anteriores al ETD (arribar antes de zarpar).
 *   2. No permite re-marcar una llegada real ya capturada.
 *   3. Sólo estados en tránsito o posteriores admiten llegada.
 */
export async function actualizarFechaLlegadaRealEmbarque(
  embarqueId: string,
  fechaIso: string,
): Promise<void> {
  // v13.814.0 (hallazgo 2): si el pre-select falla o el embarque no existe,
  // antes se ignoraba el error y todas las guardas de negocio se saltaban.
  const { data: current, error: errorCurrent } = await supabase
    .from('embarques')
    .select('estado, etd, fecha_llegada_real')
    .eq('id', embarqueId)
    .maybeSingle();
  if (errorCurrent) throw errorCurrent;
  if (!current) {
    throw new Error(
      "No se encontró el embarque para marcar la llegada real: no tienes permiso o ya no existe.",
    );
  }
  if (current?.fecha_llegada_real) {
    throw new Error("Este embarque ya tiene una fecha de llegada real capturada.");
  }
  if (current?.estado && !ESTADOS_QUE_ADMITEN_LLEGADA.has(current.estado)) {
    throw new Error(
      `No se puede marcar llegada real en estado "${current.estado}". Confirma y pon en tránsito el embarque primero.`,
    );
  }
  if (current?.etd && fechaIso < current.etd) {
    throw new Error(
      `La fecha de llegada real (${fechaIso}) no puede ser anterior al ETD (${current.etd}).`,
    );
  }
  const debeAvanzar = current?.estado
    ? ESTADOS_QUE_AVANZAN_A_ARRIBO.has(current.estado)
    : false;
  const patch: Partial<EmbarqueInsert> = { fecha_llegada_real: fechaIso };
  if (debeAvanzar) patch.estado = 'Arribo' as EmbarqueInsert['estado'];
  await actualizarEmbarqueVerificado(embarqueId, patch);
  await registrarBitacoraEmbarque({
    accion: "Actualizó fecha de llegada real de embarque",
    entidadId: embarqueId,
    detalles: { fechaLlegadaReal: fechaIso, estadoAnterior: current?.estado, avanzoAArribo: debeAvanzar },
  });
}


/**
 * Actualiza el ETA vigente del embarque. El `eta_original` queda congelado
 * por trigger de BD y no se modifica. v13.214.0.
 */
export async function actualizarEtaEmbarque(
  embarqueId: string,
  nuevaEta: string,
): Promise<void> {
  await actualizarEmbarqueVerificado(embarqueId, { eta: nuevaEta });
  await registrarBitacoraEmbarque({
    accion: "Actualizó ETA de embarque",
    entidadId: embarqueId,
    detalles: { etaNueva: nuevaEta },
  });
}

export async function insertarNotaEmbarque(
  embarqueId: string,
  contenido: string,
  usuario: string,
): Promise<void> {
  parseOrThrow(notaSchema, { contenido, usuario }, "Nota");
  await run(
    supabase.from('notas_embarque').insert({
      embarque_id: embarqueId,
      contenido,
      tipo: 'nota' as const,
      usuario,
    }),
  );
  await registrarBitacoraEmbarque({
    accion: "Agregó nota a embarque",
    entidadId: embarqueId,
    detalles: { usuario },
  });
}

/**
 * Captura/corrige el tipo de cambio USD→MXN del embarque.
 * v13.409.0: usado por la recuperación inline del error
 * `LC_PROFORMA_TC_REQUERIDO` al generar proformas con conceptos en USD.
 */
export async function actualizarTipoCambioUsdEmbarque(
  embarqueId: string,
  tipoCambioUsd: number,
): Promise<void> {
  if (!Number.isFinite(tipoCambioUsd) || tipoCambioUsd <= 0) {
    throw new Error("El tipo de cambio debe ser un número mayor a cero.");
  }
  await actualizarEmbarqueVerificado(embarqueId, { tipo_cambio_usd: tipoCambioUsd });
  await registrarBitacoraEmbarque({
    accion: "Actualizó tipo de cambio USD de embarque",
    entidadId: embarqueId,
    detalles: { tipoCambioUsd },
  });
}
