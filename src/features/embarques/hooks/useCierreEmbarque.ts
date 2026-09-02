import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { notifyError } from "@/lib/ui/appFeedback";

import {
  cerrarEmbarque,
  fetchCierreLog,
  reabrirEmbarque,
  validarCierre,
  type CierreLogEntry,
  type CierreValidacion,
} from "@/features/embarques/services/cierre";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/lib/contexts/AuthContext";

const KEYS = {
  validacion: queryKeys.embarques.cierreValidacion,
  log: queryKeys.embarques.cierreLog,
};

export function useValidacionCierre(embarqueId: string | undefined) {
  return useQuery<CierreValidacion>({
    queryKey: KEYS.validacion(embarqueId),
    queryFn: () => validarCierre(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 15_000,
  });
}

export function useCierreLog(embarqueId: string | undefined) {
  return useQuery<CierreLogEntry[]>({
    queryKey: KEYS.log(embarqueId),
    queryFn: () => fetchCierreLog(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });
}

function invalidarTodo(qc: ReturnType<typeof useQueryClient>, embarqueId: string) {
  qc.invalidateQueries({ queryKey: KEYS.validacion(embarqueId) });
  qc.invalidateQueries({ queryKey: KEYS.log(embarqueId) });
  qc.invalidateQueries({ queryKey: queryKeys.embarques.single(embarqueId) });
  qc.invalidateQueries({ queryKey: queryKeys.embarques.all });
  qc.invalidateQueries({ queryKey: queryKeys.comisiones.all });
  qc.invalidateQueries({ queryKey: queryKeys.auditoria.embarques });
}

export function useCerrarEmbarque(embarqueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cerrarEmbarque(embarqueId),
    onSuccess: () => {
      invalidarTodo(qc, embarqueId);
      notifySuccess(undefined, { title: "Embarque cerrado" });
    },
    onError: (e: Error) => notifyError(undefined, { title: e.message ?? "No se pudo cerrar el embarque", error: e, method: "FEATURES_EMBARQUES_HOOKS_USECIERREEMBARQUE_1" }),
  });
}

export function useReabrirEmbarque(embarqueId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (motivo: string) =>
      reabrirEmbarque(embarqueId, motivo, user?.email ?? ""),
    onSuccess: (resultado) => {
      if (resultado.pendiente) {
        notifyWarning(undefined, {
          title: "Reapertura en proceso",
          description: "La solicitud anterior aún se está procesando. Espera unos segundos y vuelve a intentar.",
        });
        return;
      }
      invalidarTodo(qc, embarqueId);
      notifySuccess(undefined, { title: "Embarque reabierto" });
    },

    onError: (e: Error) => notifyError(undefined, { title: e.message ?? "No se pudo reabrir el embarque", error: e, method: "FEATURES_EMBARQUES_HOOKS_USECIERREEMBARQUE_2" }),
  });
}
