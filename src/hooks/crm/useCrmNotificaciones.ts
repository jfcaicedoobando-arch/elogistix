/**
 * Notificaciones in-app del CRM.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import {
  fetchNotificaciones,
  fetchNotificacionesNoLeidasCount,
  marcarNotificacionesLeidas,
  crearNotificacionSilencioso,
  type CrmNotificacionRow,
  type CrearNotificacionInput,
} from "@/services/crm";

export type { CrmNotificacionRow, CrearNotificacionInput };
export { crearNotificacionSilencioso };

export function useCrmNotificaciones(limit = 20) {
  const { user } = useAuth();
  return useQuery<CrmNotificacionRow[]>({
    queryKey: queryKeys.crm.notificaciones.list(user?.id, limit),
    enabled: !!user?.id,
    queryFn: () => fetchNotificaciones(user!.id, limit),
    staleTime: 30_000,
  });
}

export function useCrmNotificacionesNoLeidasCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.crm.notificaciones.unreadCount(user?.id),
    enabled: !!user?.id,
    queryFn: () => fetchNotificacionesNoLeidasCount(user!.id),
    staleTime: 30_000,
  });
}

export function useMarcarNotificacionesLeidas() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      if (!user?.id) throw new Error("Sesión no encontrada");
      await marcarNotificacionesLeidas({ userId: user.id, ids });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.notificaciones.all });
    },
  });
}
