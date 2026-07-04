/**
 * Snapshots históricos (tendencia 30d). Captura idempotente al primer load
 * del tab ejecutivo para que la línea empiece a poblarse desde el día 1.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  capturarSnapshotAuditoria,
  fetchAuditoriaSnapshots,
} from "@/features/auditoria/services";
import type { AuditoriaSnapshot } from "@/features/auditoria/types";
import { logger } from "@/lib/observability/logger";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { queryKeys } from "@/lib/query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";


export function useAuditoriaSnapshots(dias = 30) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: [...queryKeys.auditoria.snapshots(dias), organizationId ?? "global"],
    queryFn: (): Promise<AuditoriaSnapshot[]> =>
      fetchAuditoriaSnapshots({ dias, organizationId }),
    staleTime: 5 * 60_000,
  });
}

// Captura idempotente: si falla la dejamos pasar (logger.warn en el caller).
// Toast molestaría al usuario porque la captura es background al abrir el tab.
export function useCapturarSnapshotAuditoria() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: () => {
      if (!organizationId) {
        return Promise.reject(new Error("Sin organización activa para capturar snapshot"));
      }
      return capturarSnapshotAuditoria(organizationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.snapshotsAll });
    },
    onError: (err: Error) => {
      logger.warn("[useCapturarSnapshotAuditoria] no se pudo capturar:", err);
    },
  });
}

/**
 * Dispara una captura idempotente del snapshot del día (UNIQUE org+fecha
 * en BD evita duplicados). Sólo se ejecuta una vez por mount.
 */
export function useAutoCapturarSnapshot(enabled: boolean) {
  const capturar = useCapturarSnapshotAuditoria();
  const { mutate } = capturar;
  useEffect(() => {
    if (!enabled) return;
    mutate(undefined, {
      onError: (err) => {
        logger.warn("[useAutoCapturarSnapshot] no se pudo capturar:", err);
      },
    });
  }, [enabled, mutate]);
}
