import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  fetchNavieras,
  insertNaviera,
  setNavieraActivo,
  deleteNaviera,
  type Naviera,
} from "@/services/catalogos";

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.navieras.all });

  const agregarNaviera = useMutation({
    mutationFn: (input: { code: string; name: string }) => insertNaviera(input),
    onSuccess: () => {
      invalidate();
      notifySuccess(toast, { title: "Naviera agregada" });
    },
    onError: (e: Error) => {
      notifyError(toast, { title: "Error al agregar naviera", message: e.message });
    },
  });

  const toggleActivo = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => setNavieraActivo(id, activo),
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      notifyError(toast, { title: "Error al actualizar", message: e.message });
    },
  });

  const eliminarNaviera = useMutation({
    mutationFn: (id: string) => deleteNaviera(id),
    onSuccess: () => {
      invalidate();
      notifySuccess(toast, { title: "Naviera eliminada" });
    },
    onError: (e: Error) => {
      notifyError(toast, { title: "Error al eliminar", message: e.message });
    },
  });

  return { agregarNaviera, toggleActivo, eliminarNaviera };
}
