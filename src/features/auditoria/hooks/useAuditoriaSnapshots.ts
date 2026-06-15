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
import { queryKeys } from "@/lib/query";
import { useOrganization } from "@/contexts/OrganizationContext";


export function useAuditoriaSnapshots(dias = 30) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: [...queryKeys.auditoria.snapshots(dias), organizationId ?? "global"],
    queryFn: (): Promise<AuditoriaSnapshot[]> =>
      fetchAuditoriaSnapshots({ dias, organizationId }),
    staleTime: 5 * 60_000,
  });
}

export function useCapturarSnapshotAuditoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: capturarSnapshotAuditoria,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.snapshotsAll });
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
