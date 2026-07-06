import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { registrarActividad } from "@/lib/domain/bitacora/registrar";
import {
  fetchCosteoTarifas,
  insertTarifaConRecargos,
  updateTarifaConRecargos,
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
      notifyError(toast, { title: "Error al guardar", description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_1" }),
  });

  const crearMultiples = useMutation({
    mutationFn: async (inputs: TarifaInput[]) => {
      const exitos: TarifaInput[] = [];
      const fallos: Array<{ input: TarifaInput; error: Error }> = [];
      for (const input of inputs) {
        try {
          await insertTarifaConRecargos(organizationId!, input);
          exitos.push(input);
        } catch (e) {
          fallos.push({ input, error: e as Error });
        }
      }
      return { exitos, fallos };
    },
    onSuccess: ({ exitos, fallos }) => {
      invalidate();
      if (fallos.length === 0) {
        toast({ title: `Se crearon ${exitos.length} tarifa${exitos.length === 1 ? "" : "s"}` });
      } else if (exitos.length === 0) {
        notifyError(toast, {
          title: "No se pudo crear ninguna tarifa",
          description: fallos[0].error.message,
          error: fallos[0].error,
          method: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_5",
        });
      } else {
        toast({
          title: `Se crearon ${exitos.length} de ${exitos.length + fallos.length} tarifas`,
          description: `Fallaron ${fallos.length}. Revisa las rutas restantes.`,
        });
      }
    },
    onError: (e: Error) =>
      notifyError(toast, { title: "Error al guardar tarifas", description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_6" }),
  });

  const actualizar = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TarifaInput }) =>
      updateTarifaConRecargos(id, input),
    onSuccess: () => {
      invalidate();
      toast({ title: "Tarifa actualizada" });
    },
    onError: (e: Error) =>
      notifyError(toast, { title: "Error al actualizar", description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_2" }),
  });

  const reemplazar = useMutation({
    mutationFn: (id: string) => marcarTarifaReemplazada(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "Tarifa marcada como reemplazada" });
    },
    onError: (e: Error) =>
      notifyError(toast, { title: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_3" }),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => deleteTarifa(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "Tarifa eliminada" });
    },
    onError: (e: Error) =>
      notifyError(toast, { title: "Error al eliminar", description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_4" }),
  });

  return { crear, crearMultiples, actualizar, reemplazar, eliminar };
}
