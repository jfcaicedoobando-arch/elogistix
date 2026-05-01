/**
 * Auditoría operativa — reporte y conteo de pendientes.
 * Toda la I/O se delega a `services/auditoria`.
 */
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  fetchAuditoriaRevisiones,
  fetchReporteAuditoria,
} from "@/services/auditoria";
import {
  AUDITORIA_REVISIONES_KEY,
  hallazgoHash,
} from "@/hooks/auditoria/useAuditoriaRevisiones";
import type { AuditoriaRevision, ReporteAuditoria } from "@/types/auditoria";

// Re-export de tipos para mantener compatibilidad con consumidores existentes.
export type {
  HallazgoAuditoria,
  ReglaAuditoria,
  SeveridadAuditoria,
  ReporteAuditoria,
} from "@/types/auditoria";

const QUERY_KEY = ["auditoria", "embarques"] as const;

/**
 * Reporte completo de auditoría operativa. Cache 5 min compartida con
 * useAuditoriaCount() para que el badge del sidebar no genere round-trips extra.
 */
export function useAuditoria() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchReporteAuditoria,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}

/**
 * Devuelve el total de hallazgos PENDIENTES (excluye los ya marcados como
 * revisados). Reusa la misma query del reporte y la de revisiones, así que si
 * /auditoria ya cargó los datos, el badge los lee del cache sin tocar la red.
 */
export function useAuditoriaCount() {
  const results = useQueries({
    queries: [
      {
        queryKey: QUERY_KEY,
        queryFn: fetchReporteAuditoria,
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
      },
      {
        queryKey: AUDITORIA_REVISIONES_KEY,
        queryFn: async (): Promise<Map<string, AuditoriaRevision>> => {
          const list = await fetchAuditoriaRevisiones();
          const map = new Map<string, AuditoriaRevision>();
          for (const r of list) {
            map.set(`${r.embarque_id}|${r.regla}|${r.detalle_hash}`, r);
          }
          return map;
        },
        staleTime: 60_000,
      },
    ],
  });
  const reporte = results[0].data as ReporteAuditoria | undefined;
  const revisiones = results[1].data as Map<string, AuditoriaRevision> | undefined;

  if (!reporte) return { data: undefined, isLoading: results[0].isLoading };

  if (!revisiones || revisiones.size === 0) {
    return { data: reporte.total_hallazgos, isLoading: false };
  }

  let pendientes = 0;
  for (const h of reporte.hallazgos) {
    const key = `${h.embarque_id}|${h.regla}|${hallazgoHash(h)}`;
    if (!revisiones.has(key)) pendientes++;
  }
  return { data: pendientes, isLoading: false };
}

export const AUDITORIA_QUERY_KEY = QUERY_KEY;
