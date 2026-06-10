import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/shared";
import {
  fetchCosteoRutas,
  insertCosteoRuta,
  deleteCosteoRuta,
  type CosteoRutaInput,
} from "@/features/costeo/services/rutas";

const KEY = ["costeo", "rutas"] as const;

export function useCosteoRutas() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: [...KEY, organizationId],
    queryFn: () => fetchCosteoRutas(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCosteoRutaMutations() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const crear = useMutation({
    mutationFn: (input: CosteoRutaInput) => insertCosteoRuta(organizationId!, input),
    onSuccess: () => { invalidate(); toast({ title: "Ruta agregada" }); },
    onError: (e: Error) => toast({ title: "Error al agregar", description: e.message, variant: "destructive" }),
  });
  const eliminar = useMutation({
    mutationFn: (id: string) => deleteCosteoRuta(id),
    onSuccess: () => { invalidate(); toast({ title: "Ruta eliminada" }); },
    onError: (e: Error) => toast({ title: "Error al eliminar", description: e.message, variant: "destructive" }),
  });
  return { crear, eliminar };
}
