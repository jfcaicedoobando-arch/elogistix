import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { useToast, useMutationWithFeedback } from "@/hooks/shared";
import { notifyError } from "@/lib/ui/appFeedback";
import { registrarActividad } from "@/services/bitacora/registrar";
import { getErrorMessage } from "@/lib/errors";
import {
  fetchCosteoTarifas,
  insertTarifaConRecargos,
  updateTarifaConRecargos,
  deleteTarifa,
  marcarTarifaReemplazada,
  type FetchTarifasFilters,
  type TarifaInput,
} from "@/features/costeo/services/tarifas";


/**
 * v13.823.151 — el listado del Portal del Agente vive bajo su propia llave
 * (`portalAgente.tarifas`). Sin invalidarla, crear/editar una tarifa desde el
 * portal cerraba el modal pero la tabla y los contadores seguían viejos hasta
 * recargar la página.
 */
const TARIFAS_INVALIDATE = [
  queryKeys.costeo.tarifas.all,
  queryKeys.portalAgente.tarifas(),
];

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

  const crear = useMutationWithFeedback({
    mutationFn: (input: TarifaInput) => insertTarifaConRecargos(organizationId!, input),
    invalidate: TARIFAS_INVALIDATE,
    successTitle: "Tarifa guardada",
    errorTitle: "Error al guardar",
    errorMethod: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_1",
    onSuccess: (row) => {
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
  });

  // NOTA: `crearMultiples` NO usa `useMutationWithFeedback` porque su éxito es
  // ramificado (exitos vs fallos parciales) y necesita 3 mensajes distintos.
  // Sigue el mismo patrón que `useMarcarRevisadosBulk`.
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
      for (const key of TARIFAS_INVALIDATE) queryClient.invalidateQueries({ queryKey: key });
      if (fallos.length === 0) {
        toast({ title: `Se crearon ${exitos.length} tarifa${exitos.length === 1 ? "" : "s"}` });
      } else if (exitos.length === 0) {
        notifyError(undefined, {
          title: "No se pudo crear ninguna tarifa",
          description: getErrorMessage(fallos[0].error),
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
      notifyError(undefined, { title: "Error al guardar tarifas", description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_6" }),
  });

  const actualizar = useMutationWithFeedback({
    mutationFn: ({ id, input }: { id: string; input: TarifaInput }) =>
      updateTarifaConRecargos(id, input),
    invalidate: TARIFAS_INVALIDATE,
    successTitle: "Tarifa actualizada",
    errorTitle: "Error al actualizar",
    errorMethod: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_2",
    onSuccess: (_data, vars) => {
      registrarActividad({ modulo: "costeo", accion: "editar", entidadId: vars.id });
    },
  });

  const reemplazar = useMutationWithFeedback({
    mutationFn: (id: string) => marcarTarifaReemplazada(id),
    invalidate: TARIFAS_INVALIDATE,
    successTitle: "Tarifa marcada como reemplazada",
    errorTitle: "Error al marcar tarifa",
    errorMethod: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_3",
    onSuccess: (_data, id) => {
      registrarActividad({ modulo: "costeo", accion: "reemplazar", entidadId: id });
    },
  });

  const eliminar = useMutationWithFeedback({
    mutationFn: (id: string) => deleteTarifa(id),
    invalidate: TARIFAS_INVALIDATE,
    successTitle: "Tarifa eliminada",
    errorTitle: "Error al eliminar",
    errorMethod: "FEATURES_COSTEO_HOOKS_USECOSTEOTARIFAS_4",
    onSuccess: (_data, id) => {
      registrarActividad({ modulo: "costeo", accion: "eliminar", entidadId: id });
    },
  });

  return { crear, crearMultiples, actualizar, reemplazar, eliminar };
}
