import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchPlanes, updatePlan, type Plan } from "@/features/admin/services/planes";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

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

  return useMutation({
    mutationFn: updatePlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planes.all });
      notifySuccess(undefined, { title: "Plan actualizado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "Error al actualizar plan", description: error.message, method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
    },
  });
}
