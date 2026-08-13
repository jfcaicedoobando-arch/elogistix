/**
 * Contexto DOF del tipo de cambio del embarque + acción para alinearlo.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  actualizarTcEmbarqueDof,
  fetchEmbarqueTcContexto,
  type EmbarqueTcContexto,
} from "@/features/embarques/services/tcEmbarqueDof";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

export function useEmbarqueTcContexto(embarqueId: string | undefined) {
  return useQuery<EmbarqueTcContexto | null>({
    queryKey: queryKeys.embarques.tcContexto(embarqueId),
    queryFn: () => fetchEmbarqueTcContexto(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAlinearTcEmbarqueDof(embarqueId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fecha: string) => actualizarTcEmbarqueDof(embarqueId as string, fecha),
    onSuccess: (res) => {
      notifySuccess(undefined, {
        title: "Tipo de cambio actualizado",
        description: `Ahora usa el DOF (${Number(res.usd_nuevo).toFixed(4)}). El P&L ya se recalculó.`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.tcContexto(embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.pnlFinanciero(embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.single(embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.full(embarqueId) });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: "No se pudo actualizar el tipo de cambio",
        description: getErrorMessage(error),
        error,
        method: "ACTUALIZAR_TC_EMBARQUE_DOF",
      });
    },
  });
}
