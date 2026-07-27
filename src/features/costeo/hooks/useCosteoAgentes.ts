import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import {
  fetchCosteoAgentes,
  insertCosteoAgente,
  updateCosteoAgente,
  deleteCosteoAgente,
  type CosteoAgenteInput,
} from "@/features/costeo/services/agentes";

export function useCosteoAgentes() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: queryKeys.costeo.agentes.list(organizationId),
    queryFn: () => fetchCosteoAgentes(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCosteoAgenteMutations() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.costeo.agentes.all });

  const crear = useMutation({
    mutationFn: (input: CosteoAgenteInput) => insertCosteoAgente(organizationId!, input),
    onSuccess: () => {
      invalidate();
      toast({ title: "Agente agregado" });
    },
    onError: (e: Error) =>
      notifyError(undefined, { title: "Error al agregar", description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USECOSTEOAGENTES_1" }),
  });

  const actualizar = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CosteoAgenteInput> }) =>
      updateCosteoAgente(id, patch),
    onSuccess: () => {
      invalidate();
      toast({ title: "Agente actualizado" });
    },
    onError: (e: Error) =>
      notifyError(undefined, { title: "Error al actualizar", description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USECOSTEOAGENTES_2" }),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => deleteCosteoAgente(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "Agente eliminado" });
    },
    onError: (e: Error) =>
      notifyError(undefined, { title: "Error al eliminar", description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USECOSTEOAGENTES_3" }),
  });

  return { crear, actualizar, eliminar };
}
