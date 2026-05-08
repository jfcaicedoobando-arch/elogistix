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


export function useAuditoriaSnapshots(dias = 30) {
  return useQuery({
    queryKey: ["auditoria", "snapshots", dias] as const,
    queryFn: (): Promise<AuditoriaSnapshot[]> => fetchAuditoriaSnapshots(dias),
    staleTime: 5 * 60_000,
  });
}

export function useCapturarSnapshotAuditoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: capturarSnapshotAuditoria,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auditoria", "snapshots"] });
    },
  });
}

/**
 * Dispara una captura idempotente del snapshot del día (UNIQUE org+fecha
 * en BD evita duplicados). Sólo se ejecuta una vez por mount.
 */
export function useAutoCapturarSnapshot(enabled: boolean) {
  const capturar = useCapturarSnapshotAuditoria();
  useEffect(() => {
    if (!enabled) return;
    capturar.mutate(undefined, {
      onError: (err) => {
        console.warn("[useAutoCapturarSnapshot] no se pudo capturar:", err);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
