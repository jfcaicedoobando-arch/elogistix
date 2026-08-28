import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';
import { registrarBitacoraEmbarque } from './bitacoraEmbarques';
import { eventoTrackingSchema } from '@/lib/validation/mutationSchemas.otros';
import { parseOrThrow } from '@/lib/validation/mutationSchemas';

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
/** B-24: tope de eventos por embarque (los más recientes primero). */
const EVENTOS_LIMIT = 500;

const EVENTO_COLS = "id, embarque_id, tipo, descripcion, ubicacion, fecha, usuario, created_at" as const;

export async function fetchEventosEmbarque(embarqueId: string): Promise<EventoEmbarqueRow[]> {
  const { data, error } = await supabase
    .from('eventos_embarque')
    .select(EVENTO_COLS).is("deleted_at", null)
    .eq('embarque_id', embarqueId)
    .order('fecha', { ascending: false })
    // L1 (auditoría 3-3): desempate estable.
    .order('id', { ascending: false })
    // B-24: tabla append-only; sin límite la query crece sin tope.
    .limit(EVENTOS_LIMIT);
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
  // B-24: boundary de validación — el schema rechaza tipos vacíos y fechas con
  // formato distinto de `AAAA-MM-DD`.
  // R-06 (QA r2): se inserta el output transformado por el schema (trim/
  // normalización), no el input crudo.
  const parsed = parseOrThrow(eventoTrackingSchema, {
    tipo: input.tipo,
    fecha: input.fecha,
    ubicacion: input.ubicacion,
    descripcion: input.descripcion,
  }, 'Evento de tracking');
  const { error } = await supabase.from('eventos_embarque').insert([
    {
      embarque_id: input.embarqueId,
      tipo: parsed.tipo as Enums<'tipo_evento_tracking'>,
      descripcion: parsed.descripcion,
      ubicacion: parsed.ubicacion,
      fecha: parsed.fecha,
      usuario: input.usuario,
    },
  ]);
  if (error) throw error;
  await registrarBitacoraEmbarque({
    accion: "Registró evento de tracking en embarque",
    entidadId: input.embarqueId,
    detalles: { tipo: parsed.tipo, ubicacion: parsed.ubicacion, fecha: parsed.fecha },
  });
}
