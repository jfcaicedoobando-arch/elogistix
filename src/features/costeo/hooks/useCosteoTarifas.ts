import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/lib/ui/appFeedback";
import { registrarActividad } from "@/services/bitacora/registrar";
import {
  fetchCosteoTarifas,
  insertTarifaConRecargos,
  updateTarifaConRecargos,
  deleteTarifa,
  marcarTarifaReemplazada,
  type FetchTarifasFilters,
  type TarifaInput,
} from "@/features/costeo/services/tarifas";


export function useCosteoTarifas(filters: FetchTarifasFilters = {}) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: queryKeys.costeo.tarifas.list(organizationId, filters),
    queryFn: () => fetchCosteoTarifas(organizationId!, filters),
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  });
}

export function useCosteoTarifaMutations() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.costeo.tarifas.all });

  const crear = useMutation({
    mutationFn: (input: TarifaInput) => insertTarifaConRecargos(organizationId!, input),
    onSuccess: (row) => {
      invalidate();
      toast({ title: "Tarifa guardada" });
      // SAFE-CAST: `row` proviene de insertTarifaConRecargos (RPC tipada como Json); solo se leen campos opcionales para bitácora.
      const rowLike = row as unknown as { id?: string; naviera_nombre?: string; origen_nombre?: string; destino_nombre?: string };
      registrarActividad({
        modulo: "costeo",
        accion: "crear",
        entidadId: rowLike?.id ?? null,
        entidadNombre: [rowLike?.origen_nombre, rowLike?.destino_nombre].filter(Boolean).join(" → "),
        detalles: { naviera: rowLike?.naviera_nombre },
      });
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
    onSuccess: (_data, vars) => {
      invalidate();
      toast({ title: "Tarifa actualizada" });
      registrarActividad({ modulo: "costeo", accion: "editar", entidadId: vars.id });
    },
    onError: (e: Error) =>
      notifyError(toast, { title: "Error al actualizar", description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_2" }),
  });

  const reemplazar = useMutation({
    mutationFn: (id: string) => marcarTarifaReemplazada(id),
    onSuccess: (_data, id) => {
      invalidate();
      toast({ title: "Tarifa marcada como reemplazada" });
      registrarActividad({ modulo: "costeo", accion: "reemplazar", entidadId: id });
    },
    onError: (e: Error) =>
      notifyError(toast, { title: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_3" }),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => deleteTarifa(id),
    onSuccess: (_data, id) => {
      invalidate();
      toast({ title: "Tarifa eliminada" });
      registrarActividad({ modulo: "costeo", accion: "eliminar", entidadId: id });
    },
    onError: (e: Error) =>
      notifyError(toast, { title: "Error al eliminar", description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_4" }),
  });

  return { crear, crearMultiples, actualizar, reemplazar, eliminar };
}
