import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';
import { registrarBitacoraEmbarque } from './bitacoraEmbarques';

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

// Columnas explícitas — evita over-fetch en una tabla append-only que crece sin límite.
const EVENTO_COLS = "id, embarque_id, tipo, descripcion, ubicacion, fecha, usuario, created_at" as const;

export async function fetchEventosEmbarque(embarqueId: string): Promise<EventoEmbarqueRow[]> {
  const { data, error } = await supabase
    .from('eventos_embarque')
    .select(EVENTO_COLS)
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
  await registrarBitacoraEmbarque({
    accion: "Registró evento de tracking en embarque",
    entidadId: input.embarqueId,
    detalles: { tipo: input.tipo, ubicacion: input.ubicacion, fecha: input.fecha },
  });
}
