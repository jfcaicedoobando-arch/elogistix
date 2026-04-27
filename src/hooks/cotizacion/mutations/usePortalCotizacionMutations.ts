import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { portalResponderCotizacion } from "@/services/cotizacion";

export function useResponderCotizacion(cotizacionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { respuesta: "Aceptada" | "Rechazada"; comentario: string }) =>
      portalResponderCotizacion(cotizacionId, params.respuesta, params.comentario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portal.cotizacion(cotizacionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.portal.cotizaciones([]) });
    },
  });
}
