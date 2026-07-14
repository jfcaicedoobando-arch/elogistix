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

// SAFE-CAST: el detalle en caché es un objeto plano `Record<string, unknown>`;
// aquí parcheamos un solo campo respetando el resto.
const patchEta = (field: "eta_actual") =>
  (old: unknown, vars: Input) => {
    if (!old || typeof old !== "object") return old;
    return { ...(old as Record<string, unknown>), [field]: vars.nuevaEta };
  };

export function useActualizarEta(options: Options = {}) {
  const { silent = false } = options;
  return useMutationWithFeedback<unknown, Error, Input>({
    mutationFn: ({ embarqueId, nuevaEta }: Input) =>
      actualizarEtaEmbarque(embarqueId, nuevaEta),
    invalidate: [queryKeys.embarques.all, queryKeys.auditoria.embarques],
    optimistic: [
      { queryKey: (v) => queryKeys.embarques.detail(v.embarqueId), updater: patchEta("eta_actual") },
      { queryKey: (v) => queryKeys.embarques.full(v.embarqueId), updater: patchEta("eta_actual") },
    ],
    successTitle: "ETA actualizada",
    errorTitle: "Error al actualizar ETA",
    errorMethod: "UPDATE_ETA_EMBARQUE",
    silent,
  });
}
