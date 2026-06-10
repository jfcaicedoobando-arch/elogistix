import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/shared";
import {
  fetchCosteoTarifas,
  insertTarifaConRecargos,
  deleteTarifa,
  marcarTarifaReemplazada,
  type FetchTarifasFilters,
  type TarifaInput,
} from "@/features/costeo/services/tarifas";

const KEY = ["costeo", "tarifas"] as const;

export function useCosteoTarifas(filters: FetchTarifasFilters = {}) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: [...KEY, organizationId, filters],
    queryFn: () => fetchCosteoTarifas(organizationId!, filters),
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  });
}

export function useCosteoTarifaMutations() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const crear = useMutation({
    mutationFn: (input: TarifaInput) => insertTarifaConRecargos(organizationId!, input),
    onSuccess: () => {
      invalidate();
      toast({ title: "Tarifa guardada" });
    },
    onError: (e: Error) =>
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" }),
  });

  const reemplazar = useMutation({
    mutationFn: (id: string) => marcarTarifaReemplazada(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "Tarifa marcada como reemplazada" });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => deleteTarifa(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "Tarifa eliminada" });
    },
    onError: (e: Error) =>
      toast({ title: "Error al eliminar", description: e.message, variant: "destructive" }),
  });

  return { crear, reemplazar, eliminar };
}
