import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchCategorias, crearCategoria, actualizarCategoria, eliminarCategoria,
} from "@/features/presupuesto/services";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { useOrgFilter } from "@/hooks/shared";

export function usePresupuestoCategorias(activas = true) {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: [...queryKeys.presupuesto.categorias(activas), organizationId ?? "none"] as const,
    queryFn: () => fetchCategorias(activas, organizationId ?? null),
    staleTime: 60_000,
  });
}

export function useCrearCategoriaPresupuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: TablesInsert<"presupuesto_categorias">) => crearCategoria(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.presupuesto.all });
      notifySuccess(undefined, { title: "Categoría creada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear categoría: ${error.message}`, error, method: "CREATE_PRESUPUESTO_CAT" });
    },
  });
}

export function useActualizarCategoriaPresupuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TablesUpdate<"presupuesto_categorias"> }) =>
      actualizarCategoria(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.presupuesto.all });
      notifySuccess(undefined, { title: "Categoría actualizada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al actualizar categoría: ${error.message}`, error, method: "UPDATE_PRESUPUESTO_CAT" });
    },
  });
}

export function useEliminarCategoriaPresupuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarCategoria(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.presupuesto.all });
      notifySuccess(undefined, { title: "Categoría eliminada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al eliminar categoría: ${error.message}`, error, method: "DELETE_PRESUPUESTO_CAT" });
    },
  });
}
