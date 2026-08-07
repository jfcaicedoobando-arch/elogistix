import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import {
  fetchBitacora,
  insertBitacora,
  type EntradaBitacora,
  type FiltrosBitacora,
} from "@/features/auditoria/services/bitacora";
import { logger } from "@/lib/observability/logger";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";


export type { EntradaBitacora };

export function useBitacora(filtros: FiltrosBitacora = {}) {
  return useQuery({
    queryKey: queryKeys.bitacora.list(filtros as Record<string, unknown>),
    queryFn: () => fetchBitacora(filtros),
    placeholderData: (prev) => prev,
    // La bitácora es histórica: no necesita refetch al recuperar el foco.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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
      detalles?: Record<string, unknown>;
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
    // Bitácora es background; un toast por cada acción registrada sería ruido.
    // Logueamos localmente Y reportamos a Sentry (v13.171.1) para detectar
    // caídas silenciosas de la bitácora sin molestar al usuario.
    onError: (err: Error) => {
      logger.warn("[useRegistrarActividad] no se pudo registrar:", err);
      reportCaughtError(err, { feature: "auditoria", op: "registrar_actividad_background" });
    },
  });
}
