/**
 * Hooks de higiene del pipeline y metas comerciales (Etapas 2 y 3 CRM Hunter).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import {
  fetchHigieneResumen,
  fetchHigieneOportunidades,
  fetchPresupuestoAnio,
  upsertPresupuestoMes,
  fetchMetasActividad,
  upsertMetaActividad,
  type HigieneResumen,
  type HigieneOportunidad,
  type PresupuestoMes,
  type MetaActividad,
} from "@/features/crm/services";

export function useHigieneResumen() {
  return useQuery<HigieneResumen>({
    queryKey: queryKeys.crm.higiene.resumen,
    queryFn: fetchHigieneResumen,
    // Los vencimientos dependen del reloj, no de una mutación: refrescamos cada
    // minuto para que la pantalla abierta no muestre SLA vencidos como vigentes.
    refetchInterval: 60_000,
  });
}

export function useHigieneOportunidades() {
  return useQuery<HigieneOportunidad[]>({
    queryKey: queryKeys.crm.higiene.oportunidades,
    queryFn: fetchHigieneOportunidades,
    refetchInterval: 60_000,
  });
}

export function usePresupuestoCrm(anio: number) {
  return useQuery<PresupuestoMes[]>({
    queryKey: queryKeys.crm.presupuesto.anio(anio),
    queryFn: () => fetchPresupuestoAnio(anio),
  });
}

export function useGuardarPresupuestoMes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertPresupuestoMes,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.presupuesto.all });
      notifySuccess(undefined, { title: "Presupuesto guardado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: "No se pudo guardar el presupuesto",
        description: getErrorMessage(error),
        error,
        method: "UPSERT_PRESUPUESTO",
      });
    },
  });
}

export function useMetasActividad() {
  return useQuery<MetaActividad[]>({
    queryKey: queryKeys.crm.metas.all,
    queryFn: fetchMetasActividad,
  });
}

export function useGuardarMetaActividad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertMetaActividad,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.metas.all });
      notifySuccess(undefined, { title: "Metas guardadas" });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: "No se pudieron guardar las metas",
        description: getErrorMessage(error),
        error,
        method: "UPSERT_METAS",
      });
    },
  });
}
