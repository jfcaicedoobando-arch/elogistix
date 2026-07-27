import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/lib/ui/appFeedback";
import {
  fetchCosteoRutas,
  insertCosteoRuta,
  deleteCosteoRuta,
  CosteoRutaDuplicadaError,
  type CosteoRutaInput,
} from "@/features/costeo/services/rutas";


export function useCosteoRutas() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: queryKeys.costeo.rutas.list(organizationId),
    queryFn: () => fetchCosteoRutas(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCosteoRutaMutations() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.costeo.rutas.all });

  const crear = useMutation({
    mutationFn: (input: CosteoRutaInput) => insertCosteoRuta(organizationId!, input),
    onSuccess: () => { invalidate(); toast({ title: "Ruta agregada" }); },
    onError: (e: Error) => notifyError(undefined, { title: e instanceof CosteoRutaDuplicadaError ? "Ruta duplicada" : "Error al agregar",
      description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USECOSTEORUTAS_1" }),
  });
  const eliminar = useMutation({
    mutationFn: (id: string) => deleteCosteoRuta(id),
    onSuccess: () => { invalidate(); toast({ title: "Ruta eliminada" }); },
    onError: (e: Error) => notifyError(undefined, { title: "Error al eliminar", description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USECOSTEORUTAS_2" }),
  });
  return { crear, eliminar };
}
