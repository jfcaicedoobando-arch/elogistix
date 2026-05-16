import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import {
  fetchBitacora,
  insertBitacora,
  type EntradaBitacora,
  type FiltrosBitacora,
} from "@/services/bitacora";
import type { Json } from "@/integrations/supabase/types";

export type { EntradaBitacora };

export function useBitacora(filtros: FiltrosBitacora = {}) {
  return useQuery({
    queryKey: queryKeys.bitacora.list(filtros as Record<string, unknown>),
    queryFn: () => fetchBitacora(filtros),
    placeholderData: (prev) => prev,
  });
}


export function useRegistrarActividad() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entrada: {
      accion: string;
      modulo: string;
      entidad_id?: string | null;
      entidad_nombre?: string;
      detalles?: Record<string, Json>;
    }) => {
      if (!user) return;
      await insertBitacora({
        usuarioId: user.id,
        usuarioEmail: user.email ?? "",
        accion: entrada.accion,
        modulo: entrada.modulo,
        entidadId: entrada.entidad_id ?? null,
        entidadNombre: entrada.entidad_nombre ?? "",
        detalles: entrada.detalles,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bitacora.all });
    },
  });
}
