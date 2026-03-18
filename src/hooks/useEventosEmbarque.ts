import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

export interface EventoEmbarque {
  id: string;
  embarque_id: string;
  tipo: string;
  descripcion: string;
  ubicacion: string;
  fecha: string;
  usuario: string;
  created_at: string;
}

export const TIPOS_EVENTO_TRACKING = [
  'Zarpe',
  'Transbordo',
  'Arribo a Puerto',
  'Descarga',
  'Despacho Aduanal',
  'Liberación',
  'En Ruta Terrestre',
  'Entrega',
  'Demora',
  'Inspección',
  'Otro',
] as const;

export function useEventosEmbarque(embarqueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.embarques.eventos(embarqueId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eventos_embarque')
        .select('*')
        .eq('embarque_id', embarqueId!)
        .order('fecha', { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventoEmbarque[];
    },
    enabled: !!embarqueId,
  });
}

interface CreateEventoInput {
  embarqueId: string;
  tipo: string;
  descripcion: string;
  ubicacion: string;
  fecha: string;
  usuario: string;
}

export function useCreateEventoEmbarque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ embarqueId, tipo, descripcion, ubicacion, fecha, usuario }: CreateEventoInput) => {
      const { error } = await supabase.from('eventos_embarque').insert({
        embarque_id: embarqueId,
        tipo: tipo as any,
        descripcion,
        ubicacion,
        fecha,
        usuario,
      });
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.embarques.eventos(vars.embarqueId) });
    },
  });
}
