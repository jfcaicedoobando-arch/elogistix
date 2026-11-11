import { supabase } from '@/integrations/supabase/client';

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
