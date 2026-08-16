/**
 * Hooks de criterios de salida por etapa y su cumplimiento por oportunidad.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { crm } from "@/features/crm/queryKeys";
import {
  fetchCriteriosPorEtapa,
  crearCriterioEtapa,
  actualizarCriterioEtapa,
  eliminarCriterioEtapa,
  fetchCumplimientoOportunidad,
  fetchAvanceCriterios,
  marcarCriterio,
  type CriterioEtapaRow,
  type CumplimientoRow,
} from "@/features/crm/services/criteriosEtapa";
import type { AvanceCriterios } from "@/features/crm/domain/criterios";

export type { CriterioEtapaRow, CumplimientoRow };

export function useCriteriosEtapa(etapaId?: string) {
  return useQuery<CriterioEtapaRow[]>({
    queryKey: crm.criterios.byEtapa(etapaId),
    queryFn: () => fetchCriteriosPorEtapa(etapaId),
  });
}

export function useCumplimientoOportunidad(oportunidadId: string | undefined) {
  return useQuery<CumplimientoRow[]>({
    queryKey: crm.criterios.cumplimiento(oportunidadId ?? ""),
    queryFn: () => fetchCumplimientoOportunidad(oportunidadId as string),
    enabled: !!oportunidadId,
  });
}

export function useAvanceCriterios(oportunidadIds: string[]) {
  return useQuery<Map<string, AvanceCriterios>>({
    queryKey: crm.criterios.avance(oportunidadIds),
    queryFn: () => fetchAvanceCriterios(oportunidadIds),
    enabled: oportunidadIds.length > 0,
    staleTime: 30_000,
  });
}

function useInvalidarCriterios() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: crm.criterios.all });
  };
}

export function useCrearCriterioEtapa() {
  const invalidar = useInvalidarCriterios();
  return useMutation({
    mutationFn: crearCriterioEtapa,
    onSuccess: invalidar,
  });
}

export function useActualizarCriterioEtapa() {
  const invalidar = useInvalidarCriterios();
  return useMutation({
    mutationFn: actualizarCriterioEtapa,
    onSuccess: invalidar,
  });
}

export function useEliminarCriterioEtapa() {
  const { user } = useAuth();
  const invalidar = useInvalidarCriterios();
  return useMutation({
    mutationFn: (id: string) => eliminarCriterioEtapa(id, user?.id ?? null),
    onSuccess: invalidar,
  });
}

export function useMarcarCriterio(oportunidadId: string) {
  const { user } = useAuth();
  const invalidar = useInvalidarCriterios();
  return useMutation({
    mutationFn: (input: { criterioId: string; cumplido: boolean }) =>
      marcarCriterio({ ...input, oportunidadId, userId: user?.id ?? null }),
    onSuccess: invalidar,
  });
}
