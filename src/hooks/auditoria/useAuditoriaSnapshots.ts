/**
 * Snapshots históricos (tendencia 30d). Captura idempotente al primer load
 * del tab ejecutivo para que la línea empiece a poblarse desde el día 1.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  capturarSnapshotAuditoria,
  fetchAuditoriaSnapshots,
} from "@/services/auditoria";
import type { AuditoriaSnapshot } from "@/types/auditoria";
import { logger } from "@/lib/observability/logger";
import { queryKeys } from "@/lib/query";


export function useAuditoriaSnapshots(dias = 30) {
  return useQuery({
    queryKey: queryKeys.auditoria.snapshots(dias),
    queryFn: (): Promise<AuditoriaSnapshot[]> => fetchAuditoriaSnapshots(dias),
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
