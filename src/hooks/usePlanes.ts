import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";

export interface Plan {
  id: string;
  nombre: string;
  max_usuarios: number;
  max_embarques_mes: number;
  almacenamiento_mb: number;
  precio_mensual: number;
  activo: boolean;
  created_at: string;
}

export function usePlanes() {
  return useQuery<Plan[]>({
    queryKey: queryKeys.planes.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planes")
        .select("*")
        .order("precio_mensual");
      if (error) throw error;
      return (data ?? []) as unknown as Plan[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (plan: Partial<Plan> & { id: string }) => {
      const { id, ...rest } = plan;
      const { error } = await supabase
        .from("planes")
        .update(rest as Record<string, unknown>)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planes.all });
      toast({ title: "Plan actualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar plan", description: error.message, variant: "destructive" });
    },
  });
}
