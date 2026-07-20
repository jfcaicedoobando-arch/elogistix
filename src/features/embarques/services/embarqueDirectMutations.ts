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
 * Actualiza la fecha de llegada real del embarque y avanza el estado a "Llegada"
 * únicamente cuando el estado actual lo permite según la máquina de estados
 * de BD (mig. `20260718214722`: `En Tránsito → Llegada`, `En Aduana → Llegada`,
 * `En Proceso → Llegada`). En cualquier otro estado sólo se actualiza el
 * campo `fecha_llegada_real` para respetar estados ya avanzados
 * (`Arribo`/`Entregado`/`EIR`/`Cerrado`) o comerciales previos y evitar
 * `LC_TRANSICION_INVALIDA`. v13.302.11.
 */
const ESTADOS_QUE_AVANZAN_A_LLEGADA = new Set(["En Tránsito", "En Aduana", "En Proceso"]);

export async function actualizarFechaLlegadaRealEmbarque(
  embarqueId: string,
  fechaIso: string,
): Promise<void> {
  const { data: current } = await supabase
    .from('embarques')
    .select('estado')
    .eq('id', embarqueId)
    .maybeSingle();
  const debeAvanzar = current?.estado
    ? ESTADOS_QUE_AVANZAN_A_LLEGADA.has(current.estado)
    : false;
  const patch: Partial<EmbarqueInsert> = { fecha_llegada_real: fechaIso };
  if (debeAvanzar) patch.estado = 'Llegada' as EmbarqueInsert['estado'];
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
