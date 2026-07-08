/**
 * Mutation: actualizar la fecha de llegada real del embarque desde el
 * formulario de tracking. Extraído de `TrackingNuevoEventoForm` (12.51.15)
 * para sacar el acceso a Supabase del componente.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { actualizarFechaLlegadaRealEmbarque } from "@/features/embarques/services";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

interface Input {
  embarqueId: string;
  fechaIso: string;
}

interface Options {
  /** Si es true, no dispara toasts internos (éxito ni error). El caller es responsable de notificar. */
  silent?: boolean;
}

export function useActualizarFechaLlegadaReal(options: Options = {}) {
  const { silent = false } = options;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ embarqueId, fechaIso }: Input) =>
      actualizarFechaLlegadaRealEmbarque(embarqueId, fechaIso),
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.full(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      if (!silent) notifySuccess(undefined, { title: "Fecha de llegada actualizada" });
    },
    onError: (error: Error) => {
      if (silent) return;
      notifyError(undefined, { title: `Error al actualizar fecha: ${error.message}`, error, method: "UPDATE_FECHA_LLEGADA_REAL" });
    },
  });
}
