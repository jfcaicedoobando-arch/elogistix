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

export function useActualizarFechaLlegadaReal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ embarqueId, fechaIso }: Input) =>
      actualizarFechaLlegadaRealEmbarque(embarqueId, fechaIso),
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.full(vars.embarqueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      notifySuccess(undefined, { title: "Fecha de llegada actualizada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al actualizar fecha: ${error.message}`, error, method: "UPDATE_FECHA_LLEGADA_REAL" });
    },
  });
}
