import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { portalResponderCotizacion } from "@/features/cotizacion/services";
import { logger } from "@/lib/observability/logger";

// NOTA: tanto onSuccess como onError los maneja
// `usePortalCotizacionDetalleController` (toast unificado + reset de estado).
// Aquí solo invalidamos cache y logueamos el error si pasa por otra ruta.
export function useResponderCotizacion(cotizacionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { respuesta: "Aceptada" | "Rechazada"; comentario: string }) =>
      portalResponderCotizacion(cotizacionId, params.respuesta, params.comentario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portal.cotizacion(cotizacionId) });
      // A5: raíz de namespace (la variante `cotizaciones([])` no matcheaba
      // las listas con clienteIds reales — prefix matching por elemento).
      queryClient.invalidateQueries({ queryKey: queryKeys.portal.cotizacionesAll });
      // A5: espejo interno — la bandeja de cotizaciones debe enterarse de la
      // respuesta del cliente (Aceptada/Rechazada) en la misma sesión.
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(cotizacionId) });
    },
    onError: (err: Error) => {
      logger.warn("[useResponderCotizacion] mutation error:", err);
    },
  });
}

