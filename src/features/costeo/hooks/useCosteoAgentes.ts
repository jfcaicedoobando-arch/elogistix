import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/shared";
import {
  fetchCosteoAgentes,
  insertCosteoAgente,
  updateCosteoAgente,
  deleteCosteoAgente,
  type CosteoAgenteInput,
} from "@/features/costeo/services/agentes";

const KEY = ["costeo", "agentes"] as const;

export function useCosteoAgentes() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: [...KEY, organizationId],
    queryFn: () => fetchCosteoAgentes(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCosteoAgenteMutations() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const crear = useMutation({
    mutationFn: (input: CosteoAgenteInput) => insertCosteoAgente(organizationId!, input),
    onSuccess: () => {
      invalidate();
      toast({ title: "Agente agregado" });
    },
    onError: (e: Error) =>
      toast({ title: "Error al agregar", description: e.message, variant: "destructive" }),
  });

  const actualizar = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CosteoAgenteInput> }) =>
      updateCosteoAgente(id, patch),
    onSuccess: () => {
      invalidate();
      toast({ title: "Agente actualizado" });
    },
    onError: (e: Error) =>
      toast({ title: "Error al actualizar", description: e.message, variant: "destructive" }),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => deleteCosteoAgente(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "Agente eliminado" });
    },
    onError: (e: Error) =>
      toast({ title: "Error al eliminar", description: e.message, variant: "destructive" }),
  });

  return { crear, actualizar, eliminar };
}
