/**
 * Hooks del historial de Tipo de Cambio DOF.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchHistorialTcDof,
  upsertTcDofManual,
  type TipoCambioDof,
} from "@/features/catalogos/services/tipoCambioDof";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";

export const tcDofKeys = {
  all: ["tipos_cambio_dof"] as const,
  historial: (limite: number) => ["tipos_cambio_dof", "historial", limite] as const,
};

export function useHistorialTcDof(limite = 60) {
  return useQuery<TipoCambioDof[]>({
    queryKey: tcDofKeys.historial(limite),
    queryFn: () => fetchHistorialTcDof(limite),
    staleTime: 15 * 60 * 1000,
  });
}

export function useUpsertTcDofManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertTcDofManual,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tcDofKeys.all });
      void qc.invalidateQueries({ queryKey: ["exchange-rates"] });
      notifySuccess(undefined, { title: "Tipo de cambio guardado", description: "El historial DOF se actualizó correctamente." });
    },
    onError: (error: unknown) => {
      notifyError(undefined, { title: "No se pudo guardar el tipo de cambio", error, method: "TC_DOF_MANUAL" });
    },
  });
}
