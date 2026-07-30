/**
 * Servicio del feed unificado de actividad de un embarque.
 * Encapsula el acceso al RPC `actividad_embarque` para que los hooks no
 * toquen el cliente Supabase directamente (jerarquía Hooks→Services→Lib).
 */
import { supabase } from '@/integrations/supabase/client';
import {
  deduplicarActividad,
  normalizarActividad,
  ordenarActividad,
  type ActividadItem,
  type ActividadRow,
} from '@/features/embarques/domain/actividadFeed';

export async function fetchActividadEmbarque(embarqueId: string): Promise<ActividadItem[]> {
  const { data, error } = await supabase.rpc('actividad_embarque', { p_embarque_id: embarqueId });
  if (error) throw error;
  // SAFE-CAST: el RPC devuelve exactamente las columnas de ActividadRow.
  const rows = (data ?? []) as unknown as ActividadRow[];
  return ordenarActividad(deduplicarActividad(normalizarActividad(rows)));
}
