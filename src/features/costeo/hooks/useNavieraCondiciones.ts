import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { useToast } from "@/hooks/shared";
import {
  fetchCondicionesNaviera,
  upsertCondicionNaviera,
  deleteCondicionNaviera,
  fetchDemorasTramos,
  replaceDemorasTramos,
  fetchTiposContenedorParaDemoras,
  fetchNavierasCatalogo,
} from "@/features/costeo/services/navieraCondiciones";
import { fetchProveedoresPorTipo } from "@/features/costeo/services/agentes";
import type { NavieraCondicionInput, DemorasTramoInput } from "@/features/costeo/types/navieraCondicion";

import { notifyError } from "@/lib/ui/appFeedback";

export function useCondicionesNaviera() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: queryKeys.costeo.navieras.condiciones.list(organizationId),
    queryFn: () => fetchCondicionesNaviera(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCondicionNavieraMutations() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.costeo.navieras.condiciones.all });

  const guardar = useMutation({
    mutationFn: (params: { input: NavieraCondicionInput; id?: string }) =>
      upsertCondicionNaviera(organizationId!, params.input, params.id),
    onSuccess: () => {
      invalidate();
      toast({ title: "Condiciones guardadas" });
    },
    onError: (e: Error) =>
      notifyError(undefined, { title: "Error al guardar", description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USENAVIERACONDICIONES_1" }),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => deleteCondicionNaviera(id),
    onSuccess: () => {
      invalidate();
      toast({ title: "Condiciones eliminadas" });
    },
    onError: (e: Error) =>
      notifyError(undefined, { title: "Error al eliminar", description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USENAVIERACONDICIONES_2" }),
  });

  return { guardar, eliminar };
}

export function useDemorasTramos(navieraCondicionId: string | null) {
  return useQuery({
    queryKey: queryKeys.costeo.navieras.demorasTramos.list(navieraCondicionId),
    queryFn: () => fetchDemorasTramos(navieraCondicionId!),
    enabled: !!navieraCondicionId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useReemplazarTramos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (params: {
      navieraCondicionId: string;
      tipoContenedorId: string;
      tramos: DemorasTramoInput[];
    }) =>
      replaceDemorasTramos(params.navieraCondicionId, params.tipoContenedorId, params.tramos),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.costeo.navieras.demorasTramos.list(vars.navieraCondicionId),
      });
      toast({ title: "Tabulador actualizado" });
    },
    onError: (e: Error) =>
      notifyError(undefined, { title: "Error al guardar tabulador", description: e.message, error: e, method: "FEATURES_COSTEO_HOOKS_USENAVIERACONDICIONES_3" }),
  });
}

export function useTiposContenedorDemoras() {
  return useQuery({
    queryKey: queryKeys.costeo.navieras.tiposContenedor(),
    queryFn: fetchTiposContenedorParaDemoras,
    staleTime: 60 * 60 * 1000,
  });
}

export function useNavierasCatalogo() {
  return useQuery({
    queryKey: queryKeys.costeo.navieras.catalogo(),
    queryFn: fetchNavierasCatalogo,
    staleTime: 60 * 60 * 1000,
  });
}

export function useProveedoresNaviera() {
  return useQuery({
    queryKey: queryKeys.costeo.proveedores.porTipo("Naviera"),
    queryFn: () => fetchProveedoresPorTipo("Naviera"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProveedoresAgente() {
  return useQuery({
    queryKey: queryKeys.costeo.proveedores.porTipo("Agente de Carga"),
    queryFn: () => fetchProveedoresPorTipo("Agente de Carga"),
    staleTime: 5 * 60 * 1000,
  });
}
