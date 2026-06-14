import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchCategorias, crearCategoria, actualizarCategoria, eliminarCategoria,
} from "@/features/presupuesto/services";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export function usePresupuestoCategorias(activas = true) {
  return useQuery({
    queryKey: [...queryKeys.presupuesto.categorias(), activas] as const,
    queryFn: () => fetchCategorias(activas),
    staleTime: 60_000,
  });
}

export function useCrearCategoriaPresupuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: TablesInsert<"presupuesto_categorias">) => crearCategoria(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.presupuesto.all }),
  });
}

export function useActualizarCategoriaPresupuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TablesUpdate<"presupuesto_categorias"> }) =>
      actualizarCategoria(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.presupuesto.all }),
  });
}

export function useEliminarCategoriaPresupuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarCategoria(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.presupuesto.all }),
  });
}
