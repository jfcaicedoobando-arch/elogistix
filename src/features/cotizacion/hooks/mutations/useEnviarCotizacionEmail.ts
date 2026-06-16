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
        toast.error("No se pudo enviar el correo");
      }
      if (cotizacionId) {
        qc.invalidateQueries({ queryKey: ["cotizacion", cotizacionId] });
        qc.invalidateQueries({ queryKey: ["cotizacion-envios", cotizacionId] });
      }
      qc.invalidateQueries({ queryKey: ["cotizaciones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useHistorialEnviosCotizacion(cotizacionId: string | undefined) {
  return useQuery<EnvioRow[]>({
    queryKey: ["cotizacion-envios", cotizacionId],
    enabled: !!cotizacionId,
    queryFn: () => fetchHistorialEnviosCotizacion(cotizacionId!),
  });
}
