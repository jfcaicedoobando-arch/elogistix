import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  enviarCotizacionPorEmail,
  type EnviarEmailInput,
} from "@/features/cotizacion/services/mutations/enviarPorEmail";
import {
  fetchHistorialEnviosCotizacion,
  type EnvioRow,
} from "@/features/cotizacion/services/envios";
import { toast } from "sonner";

import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
export type { EnvioRow } from "@/features/cotizacion/services/envios";

export function useEnviarCotizacionEmail(cotizacionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnviarEmailInput) => enviarCotizacionPorEmail(input),
    onSuccess: (res) => {
      if (res.estado === "enviado") {
        toast.success("Cotización enviada por correo");
      } else if (res.estado === "parcial") {
        toast.warning("Algunos correos no pudieron enviarse");
      } else {
        notifyError(toast, { title: "No se pudo enviar el correo", method: "FEATURES_COTIZACION_HOOKS_MUTATIONS_USEENVIARCOTIZACIONEMAIL_1" });
      }
      if (cotizacionId) {
        qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(cotizacionId) });
        qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.envios(cotizacionId) });
      }
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
    },
    onError: (e: Error) => notifyError(toast, { title: e.message, error: e, method: "FEATURES_COTIZACION_HOOKS_MUTATIONS_USEENVIARCOTIZACIONEMAIL_2" }),
  });
}

export function useHistorialEnviosCotizacion(cotizacionId: string | undefined) {
  return useQuery<EnvioRow[]>({
    queryKey: queryKeys.cotizaciones.envios(cotizacionId),
    enabled: !!cotizacionId,
    queryFn: () => fetchHistorialEnviosCotizacion(cotizacionId!),
  });
}
