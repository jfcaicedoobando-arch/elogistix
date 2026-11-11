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
  organizationId?: string | null,
): Promise<void> {
  let query = supabase
    .from('embarques')
    .update(patch)
    .eq('id', embarqueId).is('deleted_at', null);
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data, error } = await query.select('id').maybeSingle();
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

export async function insertarNotaEmbarque(
  embarqueId: string,
  contenido: string,
  usuario: string,
): Promise<string> {
  parseOrThrow(notaSchema, { contenido, usuario }, "Nota");
  const notaId = crypto.randomUUID();
  await run(
    supabase.from('notas_embarque').insert({
      id: notaId,
      embarque_id: embarqueId,
      contenido,
      tipo: 'nota' as const,
      usuario,
    }),
  );
  await registrarBitacoraEmbarque({
    accion: "Agregó nota a embarque",
    entidadId: embarqueId,
    detalles: { usuario, notaId },
  });
  return notaId;
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
