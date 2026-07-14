/**
 * Mutation: actualizar la fecha de llegada real del embarque desde el
 * formulario de tracking.
 * v13.278.0 · Fase 3 optimista: escribe fecha_llegada_real en caché del
 * detalle antes de que el servidor confirme, con rollback si falla.
 */
import { queryKeys } from "@/lib/query";
import { actualizarFechaLlegadaRealEmbarque } from "@/features/embarques/services";
import { useMutationWithFeedback } from "@/hooks/shared/useMutationWithFeedback";

interface Input {
  embarqueId: string;
  fechaIso: string;
}

interface Options {
  /** Si es true, no dispara toasts internos (éxito ni error). El caller es responsable de notificar. */
  silent?: boolean;
}

// SAFE-CAST: parcheamos un solo campo en el objeto cacheado del detalle.
const patchFecha = (old: unknown, vars: Input) => {
  if (!old || typeof old !== "object") return old;
  return { ...(old as Record<string, unknown>), fecha_llegada_real: vars.fechaIso };
};

export function useActualizarFechaLlegadaReal(options: Options = {}) {
  const { silent = false } = options;
  return useMutationWithFeedback<unknown, Error, Input>({
    mutationFn: ({ embarqueId, fechaIso }: Input) =>
      actualizarFechaLlegadaRealEmbarque(embarqueId, fechaIso),
    invalidate: [queryKeys.embarques.all, queryKeys.auditoria.embarques],
    optimistic: [
      { queryKey: (v) => queryKeys.embarques.detail(v.embarqueId), updater: patchFecha },
      { queryKey: (v) => queryKeys.embarques.full(v.embarqueId), updater: patchFecha },
    ],
    successTitle: "Fecha de llegada actualizada",
    errorTitle: "Error al actualizar fecha",
    errorMethod: "UPDATE_FECHA_LLEGADA_REAL",
    silent,
  });
}
