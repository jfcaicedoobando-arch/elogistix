import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/components/shared/utils/appFeedback";
import {
  fetchAlertasPendingCount,
  fetchAlertasSistema,
  reconocerAlerta,
  type AlertaSistema,
} from "@/features/admin/services";

export type { AlertaSistema };

const QK_PENDING = ["alertas-sistema", "pending-count"] as const;
const QK_LIST = ["alertas-sistema", "list"] as const;

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
    queryKey: [...QK_LIST, includeAcknowledged],
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
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => reconocerAlerta({ id, userId: user?.id ?? null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK_PENDING });
      qc.invalidateQueries({ queryKey: QK_LIST });
    },
    onError: (err: Error) => {
      notifyError(toast, { title: "No se pudo reconocer la alerta", description: err.message, error: err, method: "FEATURES_ADMIN_HOOKS_USEALERTASSISTEMA_1" });
    },
  });
}
