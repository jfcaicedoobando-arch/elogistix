import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";
import {
  fetchTiposContenedor,
  insertTipoContenedor,
  setTipoContenedorActivo,
  deleteTipoContenedor,
  type TipoContenedor,
} from "@/services/catalogos";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.tiposContenedor.all });

  const agregarTipo = useMutation({
    mutationFn: (input: { code: string; name: string }) => insertTipoContenedor(input),
    onSuccess: () => {
      invalidate();
      notifySuccess(toast, { title: "Tipo de contenedor agregado" });
    },
    onError: (e: Error) => {
      notifyError(toast, { title: "Error al agregar tipo", description: e.message, method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
    },
  });

  const toggleActivo = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      setTipoContenedorActivo(id, activo),
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      notifyError(toast, { title: "Error al actualizar", description: e.message, method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
    },
  });

  const eliminarTipo = useMutation({
    mutationFn: (id: string) => deleteTipoContenedor(id),
    onSuccess: () => {
      invalidate();
      notifySuccess(toast, { title: "Tipo de contenedor eliminado" });
    },
    onError: (e: Error) => {
      notifyError(toast, { title: "Error al eliminar", description: e.message, method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
    },
  });

  return { agregarTipo, toggleActivo, eliminarTipo };
}
