/**
 * useActualizarActividadNotas — mutación pequeña para editar el campo `resultado`
 * (notas) de una actividad CRM sin tocar el resto del registro.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { actualizarActividadNotas } from "@/features/crm/services";
import { queryKeys } from "@/lib/query";
import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

// NOTA: la edición de notas es inline; un toast de éxito por cada blur sería
// ruido. Solo notificamos errores.
export function useActualizarActividadNotas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: actualizarActividadNotas,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.actividades.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.higiene.all });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo guardar notas", description: getErrorMessage(error), error, method: "UPDATE_ACTIVIDAD_NOTAS" });
    },
  });
}
