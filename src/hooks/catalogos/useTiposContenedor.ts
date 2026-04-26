import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query";
import {
  fetchTiposContenedor,
  insertTipoContenedor,
  setTipoContenedorActivo,
  deleteTipoContenedor,
  type TipoContenedor,
} from "@/services/catalogosService";

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
      toast({ title: "Tipo de contenedor agregado" });
    },
    onError: (e: Error) => {
      toast({ title: "Error al agregar tipo", description: e.message, variant: "destructive" });
    },
  });

  const toggleActivo = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      setTipoContenedorActivo(id, activo),
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      toast({ title: "Error al actualizar", description: e.message, variant: "destructive" });
    },
  });

  const eliminarTipo = useMutation({
    mutationFn: (id: string) => deleteTipoContenedor(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "Tipo de contenedor eliminado" });
    },
    onError: (e: Error) => {
      toast({ title: "Error al eliminar", description: e.message, variant: "destructive" });
    },
  });

  return { agregarTipo, toggleActivo, eliminarTipo };
}
