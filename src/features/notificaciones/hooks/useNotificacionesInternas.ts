import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  fetchNotificaciones,
  marcarLeida as svcMarcarLeida,
  marcarTodasLeidas as svcMarcarTodas,
  subscribeNotificaciones,
  type NotificacionInterna,
} from "@/features/notificaciones/services";
import { notifyError } from "@/components/shared/utils/appFeedback";

export type { NotificacionInterna };

const QUERY_KEY = ["notificaciones-internas"] as const;

export function useNotificacionesInternas() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: [...QUERY_KEY, userId],
    queryFn: () => (userId ? fetchNotificaciones(userId) : Promise.resolve([])),
    enabled: !!userId,
    staleTime: 30_000,
  });

  // Realtime: refrescar al recibir cambios
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeNotificaciones(userId, () => {
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId] });
    });
    return unsubscribe;
  }, [qc, userId]);

  const marcarLeidaMut = useMutation({
    mutationFn: svcMarcarLeida,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId] }),
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al marcar notificación: ${error.message}`, error, method: "MARK_INTERNAL_NOTIF_READ" });
    },
  });

  const marcarTodasMut = useMutation({
    mutationFn: () => (userId ? svcMarcarTodas(userId) : Promise.resolve()),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId] }),
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al marcar notificaciones: ${error.message}`, error, method: "MARK_ALL_INTERNAL_NOTIF_READ" });
    },
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
