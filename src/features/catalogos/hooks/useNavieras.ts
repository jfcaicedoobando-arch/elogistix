import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchNavieras,
  insertNaviera,
  setNavieraActivo,
  deleteNaviera,
  type Naviera,
} from "@/features/catalogos/services";
import { useMutationWithFeedback } from "@/hooks/shared";

export type { Naviera };

/** Navieras activas ordenadas por nombre */
export function useNavieras() {
  return useQuery<Naviera[]>({
    queryKey: queryKeys.navieras.activas,
    queryFn: () => fetchNavieras(false),
    staleTime: 30 * 60 * 1000,
  });
}

/** Todas las navieras (incluye inactivas) para admin */
export function useAllNavieras() {
  return useQuery<Naviera[]>({
    queryKey: queryKeys.navieras.todas,
    queryFn: () => fetchNavieras(true),
    staleTime: 60 * 1000,
  });
}

export function useAdminNavieras() {
  const invalidate = queryKeys.navieras.all;

  const agregarNaviera = useMutationWithFeedback({
    mutationFn: (input: { code: string; name: string }) => insertNaviera(input),
    invalidate,
    successTitle: "Naviera agregada",
    errorTitle: "Error al agregar naviera",
  });

  const toggleActivo = useMutationWithFeedback({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => setNavieraActivo(id, activo),
    invalidate,
    errorTitle: "Error al actualizar",
  });

  const eliminarNaviera = useMutationWithFeedback({
    mutationFn: (id: string) => deleteNaviera(id),
    invalidate,
    successTitle: "Naviera eliminada",
    errorTitle: "Error al eliminar",
  });

  return { agregarNaviera, toggleActivo, eliminarNaviera };
}
