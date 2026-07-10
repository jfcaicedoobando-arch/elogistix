import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchTiposContenedor,
  insertTipoContenedor,
  setTipoContenedorActivo,
  deleteTipoContenedor,
  type TipoContenedor,
} from "@/features/catalogos/services";
import { useMutationWithFeedback } from "@/hooks/shared";

export type { TipoContenedor };

/** Tipos de contenedor activos ordenados por nombre */
export function useTiposContenedor() {
  return useQuery<TipoContenedor[]>({
    queryKey: queryKeys.tiposContenedor.activos,
    queryFn: () => fetchTiposContenedor(false),
    staleTime: 30 * 60 * 1000,
  });
}

/** Todos los tipos de contenedor (incluye inactivos) para admin */
export function useAllTiposContenedor() {
  return useQuery<TipoContenedor[]>({
    queryKey: queryKeys.tiposContenedor.todos,
    queryFn: () => fetchTiposContenedor(true),
    staleTime: 60 * 1000,
  });
}

export function useAdminTiposContenedor() {
  const invalidate = queryKeys.tiposContenedor.all;

  const agregarTipo = useMutationWithFeedback({
    mutationFn: (input: { code: string; name: string }) => insertTipoContenedor(input),
    invalidate,
    successTitle: "Tipo de contenedor agregado",
    errorTitle: "Error al agregar tipo",
  });

  const toggleActivo = useMutationWithFeedback({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      setTipoContenedorActivo(id, activo),
    invalidate,
    errorTitle: "Error al actualizar",
  });

  const eliminarTipo = useMutationWithFeedback({
    mutationFn: (id: string) => deleteTipoContenedor(id),
    invalidate,
    successTitle: "Tipo de contenedor eliminado",
    errorTitle: "Error al eliminar",
  });

  return { agregarTipo, toggleActivo, eliminarTipo };
}
