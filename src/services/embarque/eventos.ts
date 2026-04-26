import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';

export interface EventoEmbarqueRow {
  id: string;
  embarque_id: string;
  tipo: string;
  descripcion: string;
  ubicacion: string;
  fecha: string;
  usuario: string;
  created_at: string;
}

const EVENTO_COLUMNS =
  "id, embarque_id, tipo, descripcion, ubicacion, fecha, usuario, created_at" as const;

export async function fetchEventosEmbarque(embarqueId: string): Promise<EventoEmbarqueRow[]> {
  const { data, error } = await supabase
    .from('eventos_embarque')
    .select(EVENTO_COLUMNS)
    .eq('embarque_id', embarqueId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EventoEmbarqueRow[];
}

export async function insertEventoEmbarque(input: {
  embarqueId: string;
  tipo: string;
  descripcion: string;
  ubicacion: string;
  fecha: string;
  usuario: string;
}): Promise<void> {
  const { error } = await supabase.from('eventos_embarque').insert([
    {
      embarque_id: input.embarqueId,
      tipo: input.tipo as Enums<'tipo_evento_tracking'>,
      descripcion: input.descripcion,
      ubicacion: input.ubicacion,
      fecha: input.fecha,
      usuario: input.usuario,
    },
  ]);
  if (error) throw error;
}
