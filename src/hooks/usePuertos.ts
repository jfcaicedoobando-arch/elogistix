import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query";
import {
  fetchPuertos,
  insertPuerto,
  setPuertoActivo,
  deletePuerto,
  type Puerto,
} from "@/services/catalogosService";

export type { Puerto };

/** Puertos activos ordenados por país → nombre */
export function usePuertos() {
  return useQuery<Puerto[]>({
    queryKey: queryKeys.puertos.activos,
    queryFn: () => fetchPuertos(false),
    staleTime: 30 * 60 * 1000,
  });
}

/** Todos los puertos (incluye inactivos) para admin */
export function useAllPuertos() {
  return useQuery<Puerto[]>({
    queryKey: queryKeys.puertos.todos,
    queryFn: () => fetchPuertos(true),
    staleTime: 60 * 1000,
  });
}

export function useAdminPuertos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.puertos.all });

  const agregarPuerto = useMutation({
    mutationFn: (puerto: { code: string; name: string; country: string }) => insertPuerto(puerto),
    onSuccess: () => {
      invalidate();
      toast({ title: "Puerto agregado" });
    },
    onError: (e: Error) => {
      toast({ title: "Error al agregar puerto", description: e.message, variant: "destructive" });
    },
  });

  const toggleActivo = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => setPuertoActivo(id, activo),
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      toast({ title: "Error al actualizar", description: e.message, variant: "destructive" });
    },
  });

  const eliminarPuerto = useMutation({
    mutationFn: (id: string) => deletePuerto(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "Puerto eliminado" });
    },
    onError: (e: Error) => {
      toast({ title: "Error al eliminar", description: e.message, variant: "destructive" });
    },
  });

  return { agregarPuerto, toggleActivo, eliminarPuerto };
}
