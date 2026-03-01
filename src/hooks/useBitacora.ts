import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

export interface EntradaBitacora {
  id: string;
  usuario_id: string;
  usuario_email: string;
  accion: string;
  modulo: string;
  entidad_id: string | null;
  entidad_nombre: string;
  detalles: Record<string, unknown>;
  created_at: string;
}

interface FiltrosBitacora {
  modulo?: string;
  usuarioId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  limite?: number;
  pagina?: number;
}

export function useBitacora(filtros: FiltrosBitacora = {}) {
  const { limite = 50, pagina = 0, modulo, usuarioId, fechaDesde, fechaHasta } = filtros;

  return useQuery({
    queryKey: ['bitacora', filtros],
    queryFn: async () => {
      let query = supabase
        .from('bitacora_actividad')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(pagina * limite, (pagina + 1) * limite - 1);

      if (modulo) query = query.eq('modulo', modulo);
      if (usuarioId) query = query.eq('usuario_id', usuarioId);
      if (fechaDesde) query = query.gte('created_at', fechaDesde);
      if (fechaHasta) query = query.lte('created_at', fechaHasta);

      const { data, error, count } = await query;
      if (error) throw error;
      return { datos: data as EntradaBitacora[], total: count ?? 0 };
    },
  });
}

export function useActividadReciente(limite = 10) {
  return useQuery({
    queryKey: ['bitacora', 'reciente', limite],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bitacora_actividad')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limite);
      if (error) throw error;
      return data as EntradaBitacora[];
    },
  });
}

export function useRegistrarActividad() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entrada: {
      accion: string;
      modulo: string;
      entidad_id?: string | null;
      entidad_nombre?: string;
      detalles?: Record<string, Json>;
    }) => {
      if (!user) return;
      const { error } = await supabase.from('bitacora_actividad').insert([{
        usuario_id: user.id,
        usuario_email: user.email ?? '',
        accion: entrada.accion,
        modulo: entrada.modulo,
        entidad_id: entrada.entidad_id ?? null,
        entidad_nombre: entrada.entidad_nombre ?? '',
        detalles: (entrada.detalles ?? {}) as Json,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bitacora'] });
    },
  });
}
