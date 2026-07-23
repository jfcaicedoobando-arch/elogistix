/**
 * Hook para crear cotizaciones informativas (tarifarios).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { crearCotizacionInformativa } from "@/features/cotizacion/services/informativa";
import type { CotizacionInformativaInput } from "@/features/cotizacion/types";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export function useCreateCotizacionInformativa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CotizacionInformativaInput) => crearCotizacionInformativa(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      notifySuccess(undefined, { title: "Cotización informativa creada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear cotización informativa: ${error.message}`, error, method: "CREATE_COTIZACION_INFORMATIVA" });
    },
  });
}
