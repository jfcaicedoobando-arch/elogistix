import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";

export interface Naviera {
  id: string;
  code: string;
  name: string;
  activo: boolean;
  created_at: string;
}

/** Navieras activas ordenadas por nombre */
export function useNavieras() {
  return useQuery<Naviera[]>({
    queryKey: queryKeys.navieras.activas,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("navieras")
        .select("*")
        .eq("activo", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Naviera[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Todas las navieras (incluye inactivas) para admin */
export function useAllNavieras() {
  return useQuery<Naviera[]>({
    queryKey: queryKeys.navieras.todas,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("navieras")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Naviera[];
    },
    staleTime: 60 * 1000,
  });
}

export function useAdminNavieras() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.navieras.all });
  };

  const agregarNaviera = useMutation({
    mutationFn: async (naviera: { code: string; name: string }) => {
      const { error } = await supabase.from("navieras").insert(naviera);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Naviera agregada" });
    },
    onError: (e: Error) => {
      toast({ title: "Error al agregar naviera", description: e.message, variant: "destructive" });
    },
  });

  const toggleActivo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase.from("navieras").update({ activo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => {
      toast({ title: "Error al actualizar", description: e.message, variant: "destructive" });
    },
  });

  const eliminarNaviera = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("navieras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Naviera eliminada" });
    },
    onError: (e: Error) => {
      toast({ title: "Error al eliminar", description: e.message, variant: "destructive" });
    },
  });

  return { agregarNaviera, toggleActivo, eliminarNaviera };
}
