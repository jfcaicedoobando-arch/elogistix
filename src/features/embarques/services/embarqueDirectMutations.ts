/**
 * Mutaciones directas (no-RPC) contra `embarques` / `notas_embarque`.
 * Extraídas de `mutations.ts` en v13.214.1 para mantener ese archivo bajo el
 * límite Power-of-10 de 200 líneas. Barrel de services las re-exporta.
 */
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { notaSchema, parseOrThrow } from "@/lib/validation/mutationSchemas";
import { run } from "@/lib/supabase/response";

type EmbarqueInsert = TablesInsert<'embarques'>;

export async function actualizarEstadoEmbarque(embarqueId: string, estado: string): Promise<void> {
  await run(
    supabase
      .from('embarques')
      .update({ estado: estado as EmbarqueInsert['estado'] })
      .eq('id', embarqueId),
  );
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
  const { data: current } = await supabase
    .from('embarques')
    .select('estado, etd, fecha_llegada_real')
    .eq('id', embarqueId)
    .maybeSingle();
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
  await run(supabase.from('embarques').update(patch).eq('id', embarqueId));
}


/**
 * Actualiza el ETA vigente del embarque. El `eta_original` queda congelado
 * por trigger de BD y no se modifica. v13.214.0.
 */
export async function actualizarEtaEmbarque(
  embarqueId: string,
  nuevaEta: string,
): Promise<void> {
  await run(supabase.from('embarques').update({ eta: nuevaEta }).eq('id', embarqueId));
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
}
