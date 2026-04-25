import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";
import { fetchPlanes, updatePlan, type Plan } from "@/services/planesService";

export type { Plan };

export function usePlanes() {
  return useQuery<Plan[]>({
    queryKey: queryKeys.planes.all,
    queryFn: fetchPlanes,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: updatePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planes.all });
      toast({ title: "Plan actualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar plan", description: error.message, variant: "destructive" });
    },
  });
}
