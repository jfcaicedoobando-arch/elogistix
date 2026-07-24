/**
 * v13.312.20 — Ola 1 · item 3: mutaciones internas migradas a
 * `useMutationWithFeedback` (estandariza invalidación + `notifyError`).
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  fetchNotificaciones,
  marcarLeida as svcMarcarLeida,
  marcarTodasLeidas as svcMarcarTodas,
  subscribeNotificaciones,
  type NotificacionInterna,
} from "@/features/notificaciones/services";
import { useMutationWithFeedback } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";

export type { NotificacionInterna };

export function useNotificacionesInternas() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: queryKeys.notificaciones.internas(userId),
    queryFn: () => (userId ? fetchNotificaciones(userId) : Promise.resolve([])),
    enabled: !!userId,
    staleTime: 30_000,
  });

  // Realtime: refrescar al recibir cambios
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeNotificaciones(userId, () => {
      qc.invalidateQueries({ queryKey: queryKeys.notificaciones.internas(userId) });
    });
    return unsubscribe;
  }, [qc, userId]);

  const marcarLeidaMut = useMutationWithFeedback({
    mutationFn: svcMarcarLeida,
    invalidate: queryKeys.notificaciones.internas(userId),
    errorTitle: "Error al marcar notificación",
    errorMethod: "MARK_INTERNAL_NOTIF_READ",
  });

  const marcarTodasMut = useMutationWithFeedback({
    mutationFn: () => (userId ? svcMarcarTodas(userId) : Promise.resolve()),
    invalidate: queryKeys.notificaciones.internas(userId),
    errorTitle: "Error al marcar notificaciones",
    errorMethod: "MARK_ALL_INTERNAL_NOTIF_READ",
  });

  const noLeidas = (query.data ?? []).filter((n) => !n.leida).length;

  return {
    notificaciones: query.data ?? [],
    isLoading: query.isLoading,
    noLeidas,
    marcarLeida: marcarLeidaMut.mutate,
    marcarTodasLeidas: marcarTodasMut.mutate,
  };
}
