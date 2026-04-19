import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export function useResponderCotizacion(cotizacionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { respuesta: "Aceptada" | "Rechazada"; comentario: string }) => {
      const { error } = await supabase.rpc("portal_responder_cotizacion", {
        p_cotizacion_id: cotizacionId,
        p_respuesta: params.respuesta,
        p_comentario: params.comentario,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portal.cotizacion(cotizacionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.portal.cotizaciones([]) });
    },
  });
}
