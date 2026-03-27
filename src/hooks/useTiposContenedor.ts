import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";

export interface TipoContenedor {
  id: string;
  code: string;
  name: string;
  activo: boolean;
  created_at: string;
}

/** Tipos de contenedor activos ordenados por nombre */
export function useTiposContenedor() {
  return useQuery<TipoContenedor[]>({
    queryKey: queryKeys.tiposContenedor.activos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_contenedor")
        .select("*")
        .eq("activo", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as TipoContenedor[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Todos los tipos de contenedor (incluye inactivos) para admin */
export function useAllTiposContenedor() {
  return useQuery<TipoContenedor[]>({
    queryKey: queryKeys.tiposContenedor.todos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_contenedor")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as TipoContenedor[];
    },
    staleTime: 60 * 1000,
  });
}

export function useAdminTiposContenedor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tiposContenedor.all });
  };

  const agregarTipo = useMutation({
    mutationFn: async (tipo: { code: string; name: string }) => {
      const { error } = await supabase.from("tipos_contenedor").insert(tipo);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Tipo de contenedor agregado" });
    },
    onError: (e: Error) => {
      toast({ title: "Error al agregar tipo", description: e.message, variant: "destructive" });
    },
  });

  const toggleActivo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase.from("tipos_contenedor").update({ activo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      toast({ title: "Error al actualizar", description: e.message, variant: "destructive" });
    },
  });

  const eliminarTipo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tipos_contenedor").delete().eq("id", id);
      if (error) throw error;
    },
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
