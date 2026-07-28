import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { notifyError } from "@/lib/ui/appFeedback";
import {
  fetchAlertasPendingCount,
  fetchAlertasSistema,
  reconocerAlerta,
  type AlertaSistema,
} from "@/features/admin/services";
import { queryKeys } from "@/lib/query";

;

const QK_PENDING = queryKeys.alertasSistema.pending;

/** Conteo de alertas no reconocidas. Solo significativo para super_admin. */
export function useAlertasPendingCount() {
  const { role } = useAuth();
  const enabled = role === "super_admin";

  const { data } = useQuery({
    queryKey: QK_PENDING,
    queryFn: fetchAlertasPendingCount,
    enabled,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return { count: enabled ? data ?? 0 : 0 };
}

/** Listado completo de alertas (últimos 200 registros). */
export function useAlertasSistemaList(includeAcknowledged = false) {
  const { role } = useAuth();
  const enabled = role === "super_admin";

  return useQuery({
    queryKey: queryKeys.alertasSistema.list(includeAcknowledged),
    queryFn: () => fetchAlertasSistema(includeAcknowledged),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Marca una alerta como reconocida. */
export function useAcknowledgeAlerta() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (id: string) => reconocerAlerta({ id, userId: user?.id ?? null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.alertasSistema.pending });
      qc.invalidateQueries({ queryKey: queryKeys.alertasSistema.listAll });
    },
    onError: (err: Error) => {
      notifyError(undefined, { title: "No se pudo reconocer la alerta", description: err.message, error: err, method: "FEATURES_ADMIN_HOOKS_USEALERTASSISTEMA_1" });
    },
  });
}
