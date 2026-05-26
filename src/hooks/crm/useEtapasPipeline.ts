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
  type EtapaPatch,
} from "@/services/crm";

export type { CrmEtapaRow, CrmEtapaTipo, EtapaPatch };

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
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.crm.etapas.all }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.crm.motivos.all }),
  });
}

export function useCrearMotivoPerdida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crearMotivoPerdida,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.crm.motivos.all }),
  });
}
