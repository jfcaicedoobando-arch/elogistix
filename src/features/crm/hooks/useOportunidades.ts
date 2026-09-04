/**
 * Hooks de Oportunidades CRM (Fase 3). I/O delegada a `services/crm/oportunidades`.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import {
  listOportunidades,
  getOportunidad,
  crearOportunidad,
  actualizarOportunidad,
  eliminarOportunidad,
  type CrmOportunidadRow,
  type OportunidadInput as ServiceOportunidadInput,
} from "@/features/crm/services/oportunidades";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { esConflictoConcurrencia } from "@/lib/errors/concurrencia";

export type { CrmOportunidadRow, Moneda } from "@/features/crm/services/oportunidades";
export type OportunidadInput = ServiceOportunidadInput;

export interface OportunidadFiltros {
  search?: string;
  etapaId?: string | "todas";
  vendedorId?: string | "todos";
  /** v13.823.49 — filtros de cierre/monto aplicados en el servidor. */
  cierreDesde?: string;
  cierreHasta?: string;
  montoMin?: number | null;
  page?: number;
  pageSize?: number;
}

export function useOportunidades(f: OportunidadFiltros = {}) {
  const {
    search = "", etapaId = "todas", vendedorId = "todos",
    cierreDesde = "", cierreHasta = "", montoMin = null,
    page = 0, pageSize = 50,
  } = f;
  const params = { search, etapaId, vendedorId, cierreDesde, cierreHasta, montoMin, page, pageSize };
  return useQuery({
    queryKey: queryKeys.crm.oportunidades.list(params),
    placeholderData: keepPreviousData,
    queryFn: () => listOportunidades(params),
  });
}

export function useOportunidad(id: string | undefined) {
  return useQuery<CrmOportunidadRow | null>({
    queryKey: queryKeys.crm.oportunidades.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => getOportunidad(id!),
  });
}

export function useCrearOportunidad() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: OportunidadInput) => crearOportunidad(input, user),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.oportunidades.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.higiene.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.kpis });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
      notifySuccess(undefined, {
        title: "Oportunidad creada",
        description: data.avisoActividad
          ? `La actividad automática no se registró: ${data.avisoActividad}. Regístrala manualmente si la necesitas.`
          : undefined,
      });
    },

    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo crear oportunidad", description: getErrorMessage(error), error, method: "CREATE_OPORTUNIDAD" });
    },
  });
}

export function useActualizarOportunidad() {
  const qc = useQueryClient();
  const refrescar = (id: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.crm.oportunidades.all });
    qc.invalidateQueries({ queryKey: queryKeys.crm.higiene.all });
    qc.invalidateQueries({ queryKey: queryKeys.crm.oportunidades.detail(id) });
    qc.invalidateQueries({ queryKey: queryKeys.crm.kpis });
  };
  return useMutation({
    mutationFn: actualizarOportunidad,
    onSuccess: (_d, vars) => refrescar(vars.id),
    onError: (error: Error, vars) => {
      // Hallazgo 14: en conflicto de concurrencia (LC_CONFLICTO_CONCURRENCIA)
      // refrescamos igual las queries para que la UI muestre la versión
      // vigente en vez de la desactualizada que intentamos pisar.
      if (esConflictoConcurrencia(error)) refrescar(vars.id);
      notifyError(undefined, { title: "No se pudo actualizar oportunidad", description: getErrorMessage(error), error, method: "UPDATE_OPORTUNIDAD" });
    },
  });
}

export function useEliminarOportunidad() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => eliminarOportunidad(id, user?.id ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.oportunidades.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.higiene.all });
      notifySuccess(undefined, { title: "Oportunidad eliminada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo eliminar oportunidad", description: getErrorMessage(error), error, method: "DELETE_OPORTUNIDAD" });
    },
  });
}
