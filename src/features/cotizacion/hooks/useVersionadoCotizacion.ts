/**
 * Hooks de versionado de cotizaciones (Fase 2).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { recotizarCotizacion } from "@/features/cotizacion/services/versionado";

export function useRecotizarCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cotizacionId, motivo }: { cotizacionId: string; motivo: string }) =>
      recotizarCotizacion(cotizacionId, motivo),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(vars.cotizacionId) });
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      notifySuccess(undefined, {
        title: `Cotización versionada a v${data.version_nueva}`,
      });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: `No se pudo re-cotizar: ${error.message}`,
        error,
        method: "VERSIONADO_RECOTIZAR",
      });
    },
  });
}

