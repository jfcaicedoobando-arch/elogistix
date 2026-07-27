import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  enviarCotizacionPorEmail,
  type EnviarEmailInput,
} from "@/features/cotizacion/services/mutations/enviarPorEmail";
import {
  fetchHistorialEnviosCotizacion,
  type EnvioRow,
} from "@/features/cotizacion/services/envios";
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
export type { EnvioRow } from "@/features/cotizacion/services/envios";

export function useEnviarCotizacionEmail(cotizacionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnviarEmailInput) => enviarCotizacionPorEmail(input),
    onSuccess: (res) => {
      if (res.estado === "enviado") {
        notifySuccess(undefined, { title: "Cotización enviada por correo" });
      } else if (res.estado === "parcial") {
        notifyWarning(undefined, { title: "Algunos correos no pudieron enviarse" });
      } else {
        notifyError(undefined, { title: "No se pudo enviar el correo", method: "FEATURES_COTIZACION_HOOKS_MUTATIONS_USEENVIARCOTIZACIONEMAIL_1" });
      }
      if (cotizacionId) {
        qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(cotizacionId) });
        qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.envios(cotizacionId) });
      }
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
    onError: (e: Error) => notifyError(undefined, { title: e.message, error: e, method: "FEATURES_COTIZACION_HOOKS_MUTATIONS_USEENVIARCOTIZACIONEMAIL_2" }),
  });
}

export function useHistorialEnviosCotizacion(cotizacionId: string | undefined) {
  return useQuery<EnvioRow[]>({
    queryKey: queryKeys.cotizaciones.envios(cotizacionId),
    enabled: !!cotizacionId,
    queryFn: () => fetchHistorialEnviosCotizacion(cotizacionId!),
  });
}
