/**
 * Mutation: actualizar el ETA vigente del embarque desde el tab de Tracking.
 * El `eta_original` queda congelado por trigger de BD.
 * v13.214.0.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { actualizarEtaEmbarque } from "@/features/embarques/services";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

interface Input {
  embarqueId: string;
  nuevaEta: string;
}

interface Options {
  /** Si es true, no dispara toasts internos (éxito ni error). El caller es responsable de notificar. */
  silent?: boolean;
}

export function useActualizarEta(options: Options = {}) {
  const { silent = false } = options;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ embarqueId, nuevaEta }: Input) =>
      actualizarEtaEmbarque(embarqueId, nuevaEta),
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.full(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      if (!silent) notifySuccess(undefined, { title: "ETA actualizada" });
    },
    onError: (error: Error) => {
      if (silent) return;
      notifyError(undefined, {
        title: `Error al actualizar ETA: ${error.message}`,
        error,
        method: "UPDATE_ETA_EMBARQUE",
      });
    },
  });
}
