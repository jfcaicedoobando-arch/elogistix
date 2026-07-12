/**
 * Mutation: actualizar el ETA vigente del embarque desde el tab de Tracking.
 * El `eta_original` queda congelado por trigger de BD.
 * v13.278.0 · Fase 3 optimista: escribe eta_actual en caché del detalle
 * antes de que el servidor confirme, con rollback automático si falla.
 */
import { queryKeys } from "@/lib/query";
import { actualizarEtaEmbarque } from "@/features/embarques/services";
import { useMutationWithFeedback } from "@/hooks/shared/useMutationWithFeedback";

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
  return useMutationWithFeedback<unknown, Error, Input>({
    mutationFn: ({ embarqueId, nuevaEta }: Input) =>
      actualizarEtaEmbarque(embarqueId, nuevaEta),
    invalidate: [
      queryKeys.embarques.all,
    ],
    optimistic: [
      {
        queryKey: (vars) => queryKeys.embarques.detail(vars.embarqueId),
        // SAFE-CAST: el detalle en caché es un objeto plano; parcheamos eta_actual.
        updater: (old, vars) => {
          if (!old || typeof old !== "object") return old;
          return { ...(old as Record<string, unknown>), eta_actual: vars.nuevaEta };
        },
      },
      {
        queryKey: (vars) => queryKeys.embarques.full(vars.embarqueId),
        updater: (old, vars) => {
          if (!old || typeof old !== "object") return old;
          return { ...(old as Record<string, unknown>), eta_actual: vars.nuevaEta };
        },
      },
    ],
    successTitle: silent ? undefined : "ETA actualizada",
    errorTitle: silent ? undefined : "Error al actualizar ETA",
    errorMethod: "UPDATE_ETA_EMBARQUE",
  });
}
