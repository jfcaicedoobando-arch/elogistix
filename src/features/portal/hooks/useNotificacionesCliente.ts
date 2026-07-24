/**
 * Bloque 3.3 — Notificaciones del cliente en su portal.
 * Lee la tabla `notificaciones_cliente` filtrada por RLS y expone helpers
 * para marcar leídas (una o todas).
 *
 * v13.312.20 — Ola 1 · item 3: mutaciones migradas a `useMutationWithFeedback`
 * para estandarizar invalidación + `notifyError` (elimina toasts duplicados).
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchNotificacionesCliente,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
} from "@/features/portal/services";
import { useMutationWithFeedback } from "@/hooks/shared";

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
  return useMutationWithFeedback({
    mutationFn: marcarNotificacionLeida,
    invalidate: KEY,
    errorTitle: "Error al marcar notificación",
    errorMethod: "MARK_NOTIF_READ",
  });
}

export function useMarcarTodasLeidas() {
  return useMutationWithFeedback({
    mutationFn: marcarTodasNotificacionesLeidas,
    invalidate: KEY,
    errorTitle: "Error al marcar notificaciones",
    errorMethod: "MARK_ALL_NOTIF_READ",
  });
}
