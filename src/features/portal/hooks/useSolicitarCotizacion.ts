/**
 * Mutación para registrar una solicitud de cotización desde el portal.
 * Invalida el listado de cotizaciones del cliente al terminar.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError } from "@/lib/ui/appFeedback";
import {
  solicitarCotizacionPortal,
  type SolicitudCotizacionInput,
} from "@/features/portal/services/solicitudes";

export function useSolicitarCotizacion(clienteIds: string[]) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SolicitudCotizacionInput) => solicitarCotizacionPortal(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.portal.cotizaciones(clienteIds),
      });
    },
    onError: (error) => {
      notifyError(undefined, {
        title: "No pudimos enviar tu solicitud",
        error,
      });
    },
  });
}
