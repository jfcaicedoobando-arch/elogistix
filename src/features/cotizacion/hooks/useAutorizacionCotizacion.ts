import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { cotizaciones as cotizacionKeys } from "@/features/cotizacion/queryKeys";
import { autorizarCotizacion, solicitarAutorizacionCotizacion } from "@/features/cotizacion/services/autorizacionCotizacion";

type Input = { tipo: "solicitar"; id: string } | { tipo: "autorizar"; id: string; motivo: string | null };

export function useAutorizacionCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: Input) => i.tipo === "solicitar" ? solicitarAutorizacionCotizacion(i.id) : autorizarCotizacion(i.id, i.motivo),
    onSuccess: async (_d, i) => {
      await qc.invalidateQueries({ queryKey: cotizacionKeys.detail(i.id) });
      void qc.invalidateQueries({ queryKey: cotizacionKeys.all });
      notifySuccess(undefined, { title: i.tipo === "solicitar" ? "Autorización solicitada" : "Cotización autorizada" });
    },
    onError: (error, variables) => notifyError(undefined, { title: "No se pudo completar la autorización",
      description: getErrorMessage(error), error, method: "COT_AUTORIZACION", context: { variables } }),
  });
}
