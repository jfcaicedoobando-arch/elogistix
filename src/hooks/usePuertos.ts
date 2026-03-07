import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";

export interface Puerto {
  id: string;
  code: string;
  name: string;
  country: string;
  activo: boolean;
  created_at: string;
}

/** Puertos activos ordenados por país → nombre */
export function usePuertos() {
  return useQuery<Puerto[]>({
    queryKey: queryKeys.puertos.activos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("puertos")
        .select("*")
        .eq("activo", true)
        .order("country")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Puerto[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Todos los puertos (incluye inactivos) para admin */
export function useAllPuertos() {
  return useQuery<Puerto[]>({
    queryKey: queryKeys.puertos.todos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("puertos")
        .select("*")
        .order("country")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Puerto[];
    },
    staleTime: 60 * 1000,
  });
}

export function useAdminPuertos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.puertos.all });
  };

  const agregarPuerto = useMutation({
    mutationFn: async (puerto: { code: string; name: string; country: string }) => {
      const { error } = await supabase.from("puertos").insert(puerto as any);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Puerto agregado" });
    },
    onError: (e: Error) => {
      toast({ title: "Error al agregar puerto", description: e.message, variant: "destructive" });
    },
  });

  const toggleActivo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase.from("puertos").update({ activo } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      toast({ title: "Error al actualizar", description: e.message, variant: "destructive" });
    },
  });

  const eliminarPuerto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("puertos").delete().eq("id", id);
      if (error) throw error;
    },
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
