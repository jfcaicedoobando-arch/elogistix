/**
 * Mutaciones directas (no-RPC) contra `embarques` / `notas_embarque`.
 * Extraídas de `mutations.ts` en v13.214.1 para mantener ese archivo bajo el
 * límite Power-of-10 de 200 líneas. Barrel de services las re-exporta.
 */
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { notaSchema, parseOrThrow } from "@/lib/validation/mutationSchemas";

type EmbarqueInsert = TablesInsert<'embarques'>;

export async function actualizarEstadoEmbarque(embarqueId: string, estado: string): Promise<void> {
  const { error } = await supabase
    .from('embarques')
    .update({ estado: estado as EmbarqueInsert['estado'] })
    .eq('id', embarqueId);
  if (error) throw error;
}

/**
 * Actualiza la fecha de llegada real del embarque y avanza el estado a "Arribo".
 * v13.214.0: única vía UI para marcar el arribo del embarque, invocada desde
 * el tab de Tracking. RLS aplica tenancy automáticamente.
 */
export async function actualizarFechaLlegadaRealEmbarque(
  embarqueId: string,
  fechaIso: string,
): Promise<void> {
  const { error } = await supabase
    .from('embarques')
    .update({
      fecha_llegada_real: fechaIso,
      estado: 'Arribo' as EmbarqueInsert['estado'],
    })
    .eq('id', embarqueId);
  if (error) throw error;
}

/**
 * Actualiza el ETA vigente del embarque. El `eta_original` queda congelado
 * por trigger de BD y no se modifica. v13.214.0.
 */
export async function actualizarEtaEmbarque(
  embarqueId: string,
  nuevaEta: string,
): Promise<void> {
  const { error } = await supabase
    .from('embarques')
    .update({ eta: nuevaEta })
    .eq('id', embarqueId);
  if (error) throw error;
}

export async function insertarNotaEmbarque(
  embarqueId: string,
  contenido: string,
  usuario: string,
): Promise<void> {
  parseOrThrow(notaSchema, { contenido, usuario }, "Nota");
  const { error } = await supabase.from('notas_embarque').insert({
    embarque_id: embarqueId,
    contenido,
    tipo: 'nota' as const,
    usuario,
  });
  if (error) throw error;
}
