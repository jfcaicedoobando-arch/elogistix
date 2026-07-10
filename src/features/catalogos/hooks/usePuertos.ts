import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchPuertos,
  insertPuerto,
  setPuertoActivo,
  deletePuerto,
  type Puerto,
} from "@/features/catalogos/services";
import { useMutationWithFeedback } from "@/hooks/shared";

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
  const invalidate = queryKeys.puertos.all;

  const agregarPuerto = useMutationWithFeedback({
    mutationFn: (p: { code: string; name: string; country: string }) => insertPuerto(p),
    invalidate,
    successTitle: "Puerto agregado",
    errorTitle: "Error al agregar puerto",
  });

  const toggleActivo = useMutationWithFeedback({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => setPuertoActivo(id, activo),
    invalidate,
    errorTitle: "Error al actualizar",
  });

  const eliminarPuerto = useMutationWithFeedback({
    mutationFn: (id: string) => deletePuerto(id),
    invalidate,
    successTitle: "Puerto eliminado",
    errorTitle: "Error al eliminar",
  });

  return { agregarPuerto, toggleActivo, eliminarPuerto };
}
