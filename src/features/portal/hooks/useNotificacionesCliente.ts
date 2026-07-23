/**
 * Bloque 3.3 — Notificaciones del cliente en su portal.
 * Lee la tabla `notificaciones_cliente` filtrada por RLS y expone helpers
 * para marcar leídas (una o todas).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotificacionesCliente,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
} from "@/features/portal/services";
import { notifyError } from "@/lib/ui/appFeedback";

const KEY = ["portal", "notificaciones"] as const;

export type { NotificacionCliente } from "@/features/portal/types/portal";

export function useNotificacionesCliente(enabled = true) {
  return useQuery({
    queryKey: KEY,
    enabled,
    queryFn: fetchNotificacionesCliente,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarcarNotificacionLeida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: marcarNotificacionLeida,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al marcar notificación: ${error.message}`, error, method: "MARK_NOTIF_READ" });
    },
  });
}

export function useMarcarTodasLeidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: marcarTodasNotificacionesLeidas,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al marcar notificaciones: ${error.message}`, error, method: "MARK_ALL_NOTIF_READ" });
    },
  });
}
