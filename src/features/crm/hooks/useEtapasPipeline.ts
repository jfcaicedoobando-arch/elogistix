/**
 * Hooks de etapas del pipeline (CRM).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchEtapasPipelineActivas,
  fetchEtapasPipelineTodas,
  actualizarEtapa,
  fetchMotivosPerdida,
  actualizarMotivoPerdida,
  crearMotivoPerdida,
  type CrmEtapaRow,
  type CrmEtapaTipo,
} from "@/features/crm/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export type { CrmEtapaRow, CrmEtapaTipo,  };

export function useEtapasPipeline() {
  return useQuery<CrmEtapaRow[]>({
    queryKey: queryKeys.crm.etapas.all,
    queryFn: fetchEtapasPipelineActivas,
  });
}

export function useActualizarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: actualizarEtapa,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.etapas.all });
      notifySuccess(undefined, { title: "Etapa actualizada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al actualizar etapa: ${error.message}`, error, method: "UPDATE_ETAPA" });
    },
  });
}

export function useMotivosPerdida(soloActivos = true) {
  return useQuery({
    queryKey: queryKeys.crm.motivos.list(soloActivos),
    queryFn: () => fetchMotivosPerdida(soloActivos),
  });
}

/** Lista TODAS las etapas (activas e inactivas) para pantalla de configuración. */
export function useEtapasPipelineAll() {
  return useQuery<CrmEtapaRow[]>({
    queryKey: queryKeys.crm.etapas.todas,
    queryFn: fetchEtapasPipelineTodas,
  });
}

export function useActualizarMotivoPerdida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: actualizarMotivoPerdida,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.motivos.all });
      notifySuccess(undefined, { title: "Motivo actualizado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al actualizar motivo: ${error.message}`, error, method: "UPDATE_MOTIVO_PERDIDA" });
    },
  });
}

export function useCrearMotivoPerdida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crearMotivoPerdida,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.motivos.all });
      notifySuccess(undefined, { title: "Motivo creado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear motivo: ${error.message}`, error, method: "CREATE_MOTIVO_PERDIDA" });
    },
  });
}
