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
 * Actualiza la fecha de llegada real del embarque y avanza el estado a "Llegada".
 * v13.302.8: la máquina de estados vigente (migración 20260718214722) sólo
 * permite `En Tránsito → Llegada`. Antes se seteaba `Arribo` directamente, lo
 * que disparaba `LC_TRANSICION_INVALIDA` desde el trigger de BD. `Arribo` es
 * un estado posterior que se alcanza desde `Llegada`.
 */
export async function actualizarFechaLlegadaRealEmbarque(
  embarqueId: string,
  fechaIso: string,
): Promise<void> {
  await run(
    supabase
      .from('embarques')
      .update({
        fecha_llegada_real: fechaIso,
        estado: 'Llegada' as EmbarqueInsert['estado'],
      })
      .eq('id', embarqueId),
  );
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
