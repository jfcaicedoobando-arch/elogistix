/**
 * Hooks de Actividades CRM (Fase 4) — polimórficas vía entidad_tipo + entidad_id.
 * I/O delegada a `services/crm/actividades`.
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
  listActividades,
  crearActividad,
  completarActividad,
  posponerActividad,
  type CrmActividadTipo,
  type CrmEntidadTipo,
  type CrearActividadInput,
} from "@/features/crm/services/actividades";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

export type { CrmActividadRow, CrmActividadTipo, CrmEntidadTipo } from "@/features/crm/services/actividades";
export type ActividadInput = CrearActividadInput;

export const ACTIVIDAD_TIPOS: CrmActividadTipo[] = [
  "llamada",
  "email",
  "reunion",
  "tarea",
  "nota",
];

export interface ActividadFiltros {
  search?: string;
  tipo?: CrmActividadTipo | "todos";
  estado?: "pendientes" | "completadas" | "todas";
  responsable?: "mias" | "todos";
  entidadTipo?: CrmEntidadTipo;
  entidadId?: string;
  page?: number;
  pageSize?: number;
}

export function useActividades(f: ActividadFiltros = {}) {
  const { user } = useAuth();
  const {
    search = "",
    tipo = "todos",
    estado = "todas",
    responsable = "todos",
    entidadTipo,
    entidadId,
    page = 0,
    pageSize = 25,
  } = f;
  return useQuery({
    queryKey: queryKeys.crm.actividades.list({ search, tipo, estado, responsable, entidadTipo, entidadId, page, pageSize, uid: user?.id }),
    placeholderData: keepPreviousData,
    queryFn: () =>
      listActividades({ search, tipo, estado, responsable, entidadTipo, entidadId, page, pageSize, userId: user?.id, userEmail: user?.email }),
  });
}

export function useCrearActividad() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: ActividadInput) => crearActividad(input, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.actividades.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.kpis });
      notifySuccess(undefined, { title: "Actividad agregada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo crear actividad", description: getErrorMessage(error), error, method: "CREATE_ACTIVIDAD" });
    },
  });
}

export function useCompletarActividad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: completarActividad,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.actividades.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
      notifySuccess(undefined, { title: "Actividad completada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo completar actividad", description: getErrorMessage(error), error, method: "COMPLETE_ACTIVIDAD" });
    },
  });
}

/** Pospone una actividad N días desde la fecha programada (o hoy si no tiene). */
export function usePosponerActividad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: posponerActividad,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.actividades.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
      notifySuccess(undefined, { title: "Actividad pospuesta" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo posponer actividad", description: getErrorMessage(error), error, method: "POSTPONE_ACTIVIDAD" });
    },
  });
}
