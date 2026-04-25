import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesInsert } from '@/integrations/supabase/types';

type EmbarqueInsert = TablesInsert<'embarques'>;

export interface CrearEmbarqueRpcInput {
  embarque: TablesInsert<'embarques'>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
  documentos: Omit<TablesInsert<'documentos_embarque'>, 'embarque_id'>[];
}

export async function crearEmbarqueRpc(input: CrearEmbarqueRpcInput): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc('crear_embarque_completo', {
    p_embarque: input.embarque as unknown as Json,
    p_conceptos_venta: input.conceptosVenta as unknown as Json,
    p_conceptos_costo: input.conceptosCosto as unknown as Json,
    p_documentos: input.documentos as unknown as Json,
  });
  if (error) throw error;
  return data as unknown as { id: string };
}

export interface ActualizarEmbarqueRpcInput {
  id: string;
  embarque: Partial<TablesInsert<'embarques'>>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
}

export async function actualizarEmbarqueRpc(input: ActualizarEmbarqueRpcInput): Promise<void> {
  const { error } = await supabase.rpc('actualizar_embarque_completo', {
    p_embarque_id: input.id,
    p_embarque: input.embarque as unknown as Json,
    p_conceptos_venta: input.conceptosVenta as unknown as Json,
    p_conceptos_costo: input.conceptosCosto as unknown as Json,
  });
  if (error) throw error;
}

export async function duplicarEmbarqueRpc(
  embarqueOrigenId: string,
  copias: Array<{
    num_contenedor: string;
    tipo_contenedor: string;
    peso_kg: number;
    volumen_m3: number;
    piezas: number;
  }>,
): Promise<{ id: string; expediente: string }[]> {
  const { data, error } = await supabase.rpc('duplicar_embarque_completo', {
    p_embarque_origen_id: embarqueOrigenId,
    p_copias: copias as unknown as Json,
  });
  if (error) throw error;
  return data as unknown as { id: string; expediente: string }[];
}

export async function eliminarEmbarqueRpc(embarqueId: string): Promise<void> {
  const { error } = await supabase.rpc('eliminar_embarque_completo', {
    p_embarque_id: embarqueId,
  });
  if (error) throw error;
}

export async function actualizarEstadoEmbarque(embarqueId: string, estado: string): Promise<void> {
  const { error } = await supabase
    .from('embarques')
    .update({ estado: estado as EmbarqueInsert['estado'] })
    .eq('id', embarqueId);
  if (error) throw error;
}

export async function insertarNotaCambioEstado(
  embarqueId: string,
  contenido: string,
  usuarioEmail: string,
): Promise<void> {
  const { error } = await supabase.from('notas_embarque').insert({
    embarque_id: embarqueId,
    contenido,
    tipo: 'cambio_estado' as const,
    usuario: usuarioEmail,
  });
  if (error) throw error;
}

export async function insertarNotaEmbarque(
  embarqueId: string,
  contenido: string,
  usuario: string,
): Promise<void> {
  const { error } = await supabase.from('notas_embarque').insert({
    embarque_id: embarqueId,
    contenido,
    tipo: 'nota' as const,
    usuario,
  });
  if (error) throw error;
}
