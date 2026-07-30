/**
 * Hook del feed unificado de actividad de un embarque.
 * Consume el RPC `actividad_embarque`, que reúne notas, eventos, documentos,
 * bitácora, cotización, proformas, facturas, pagos, CxP, buzón, garantías,
 * seguros y cierres en una sola consulta.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query';
import {
  agruparPorDia,
  contarPorCategoria,
  deduplicarActividad,
  filtrarPorCategoria,
  normalizarActividad,
  ordenarActividad,
  type ActividadCategoria,
  type ActividadGrupo,
  type ActividadItem,
  type ActividadRow,
} from '@/features/embarques/domain/actividadFeed';

async function fetchActividad(embarqueId: string): Promise<ActividadItem[]> {
  const { data, error } = await supabase.rpc('actividad_embarque', { p_embarque_id: embarqueId });
  if (error) throw error;
  // SAFE-CAST: el RPC devuelve exactamente las columnas de ActividadRow.
  const rows = (data ?? []) as unknown as ActividadRow[];
  return ordenarActividad(deduplicarActividad(normalizarActividad(rows)));
}

interface Resultado {
  items: ActividadItem[];
  grupos: ActividadGrupo[];
  conteos: Record<string, number>;
  categoria: ActividadCategoria | 'todos';
  setCategoria: (c: ActividadCategoria | 'todos') => void;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useActividadEmbarque(embarqueId: string | undefined): Resultado {
  const [categoria, setCategoria] = useState<ActividadCategoria | 'todos'>('todos');

  const query = useQuery({
    queryKey: queryKeys.embarques.actividad(embarqueId),
    queryFn: () => fetchActividad(embarqueId!),
    enabled: !!embarqueId,
    staleTime: 30_000,
  });

  const todos = useMemo(() => query.data ?? [], [query.data]);
  const items = useMemo(() => filtrarPorCategoria(todos, categoria), [todos, categoria]);
  const grupos = useMemo(() => agruparPorDia(items), [items]);
  const conteos = useMemo(() => contarPorCategoria(todos), [todos]);

  return {
    items,
    grupos,
    conteos,
    categoria,
    setCategoria,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
