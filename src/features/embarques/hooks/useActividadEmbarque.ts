/**
 * Hook del feed unificado de actividad de un embarque.
 * Consume el RPC `actividad_embarque`, que reúne notas, eventos, documentos,
 * bitácora, cotización, proformas, facturas, pagos, CxP, buzón, garantías,
 * seguros y cierres en una sola consulta.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { fetchActividadEmbarque } from '@/features/embarques/services/actividadEmbarque';
import {
  agruparPorDia,
  contarPorCategoria,
  filtrarPorCategoria,
  type ActividadCategoria,
  type ActividadGrupo,
  type ActividadItem,
} from '@/features/embarques/domain/actividadFeed';


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
    queryFn: () => fetchActividadEmbarque(embarqueId!),
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
