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

export type { CrmOportunidadRow, Moneda } from "@/features/crm/services/oportunidades";
export type OportunidadInput = ServiceOportunidadInput;

export interface OportunidadFiltros {
  search?: string;
  etapaId?: string | "todas";
  vendedorId?: string | "todos";
  page?: number;
  pageSize?: number;
}

export function useOportunidades(f: OportunidadFiltros = {}) {
  const { search = "", etapaId = "todas", vendedorId = "todos", page = 0, pageSize = 50 } = f;
  return useQuery({
    queryKey: queryKeys.crm.oportunidades.list({ search, etapaId, vendedorId, page, pageSize }),
    placeholderData: keepPreviousData,
    queryFn: () => listOportunidades({ search, etapaId, vendedorId, page, pageSize }),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.oportunidades.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.kpis });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
      notifySuccess(undefined, { title: "Oportunidad creada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear oportunidad: ${error.message}`, error, method: "CREATE_OPORTUNIDAD" });
    },
  });
}

export function useActualizarOportunidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: actualizarOportunidad,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.oportunidades.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.oportunidades.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.crm.kpis });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al actualizar oportunidad: ${error.message}`, error, method: "UPDATE_OPORTUNIDAD" });
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
      notifySuccess(undefined, { title: "Oportunidad eliminada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al eliminar oportunidad: ${error.message}`, error, method: "DELETE_OPORTUNIDAD" });
    },
  });
}
