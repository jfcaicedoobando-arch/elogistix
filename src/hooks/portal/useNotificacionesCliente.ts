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
} from "@/services/portal";

const KEY = ["portal", "notificaciones"] as const;

export type { NotificacionCliente } from "@/types/portal";

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
  });
}

export function useMarcarTodasLeidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: marcarTodasNotificacionesLeidas,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
