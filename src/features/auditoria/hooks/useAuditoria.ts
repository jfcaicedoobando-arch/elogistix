/**
 * Auditoría operativa — reporte y conteo de pendientes.
 * Toda la I/O se delega a `services/auditoria`.
 */
import { useQueries, useQuery } from "@tanstack/react-query";
import { fetchReporteAuditoria } from "@/features/auditoria/services";
import { AUDITORIA_REVISIONES_KEY, hallazgoHash } from "@/features/auditoria/hooks/useAuditoriaRevisiones";
import { buildRevisionesMap } from "@/features/auditoria/hooks/revisiones/query";
import type { AuditoriaRevision, ReporteAuditoria } from "@/features/auditoria/types";

const QUERY_KEY = ["auditoria", "embarques"] as const;

/**
 * Reporte completo de auditoría operativa. Cache 5 min compartida con
 * useAuditoriaCount() para que el badge del sidebar no genere round-trips extra.
 */
export function useAuditoria(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchReporteAuditoria,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    enabled,
  });
}

/**
 * Devuelve el total de hallazgos PENDIENTES (excluye los ya marcados como
 * revisados). Reusa la misma query del reporte y la de revisiones, así que si
 * /auditoria ya cargó los datos, el badge los lee del cache sin tocar la red.
 *
 * `enabled` permite que callers (p. ej. el sidebar) deshabiliten el hook para
 * roles sin acceso al RPC `auditoria_embarques_org`, evitando 403 ruidosos que
 * antes terminaban en Sentry vía `QueryCache.onError`.
 */
export function useAuditoriaCount(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const results = useQueries({
    queries: [
      {
        queryKey: QUERY_KEY,
        queryFn: fetchReporteAuditoria,
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
        enabled,
      },
      {
        queryKey: AUDITORIA_REVISIONES_KEY,
        // Misma queryFn que `useAuditoriaRevisiones` → React Query siempre
        // produce el mismo Map sin depender del orden de montaje.
        queryFn: buildRevisionesMap,
        staleTime: 60_000,
        enabled,
      },
    ],
  });
  if (!enabled) {
    return { data: undefined, isLoading: false, isError: false, error: null };
  }

  // SAFE-CAST: useQueries pierde la inferencia de tipos heterogéneos; ambos
  // queryFn están tipados arriba (fetchReporteAuditoria → ReporteAuditoria,
  // buildRevisionesMap → Map<string, AuditoriaRevision>), así que el shape
  // coincide en runtime con lo que regresa el cache de React Query.
  const reporte = results[0].data as ReporteAuditoria | undefined;
  const revisiones = results[1].data as Map<string, AuditoriaRevision> | undefined;
  const isError = results[0].isError || results[1].isError;
  const error = results[0].error ?? results[1].error ?? null;

  // Guard defensivo: si el RPC cambiara su firma y devolviera algo distinto,
  // tratamos el reporte como ausente en lugar de explotar en runtime.
  if (reporte && (!Array.isArray(reporte.hallazgos) || typeof reporte.total_hallazgos !== "number")) {
    return { data: undefined, isLoading: false, isError: true, error: new Error("Shape inválido en reporte") };
  }

  if (!reporte) return { data: undefined, isLoading: results[0].isLoading, isError, error };

  if (!revisiones || revisiones.size === 0) {
    return { data: reporte.total_hallazgos, isLoading: false, isError, error };
  }

  let pendientes = 0;
  for (const h of reporte.hallazgos) {
    const key = `${h.embarque_id}|${h.regla}|${hallazgoHash(h)}`;
    if (!revisiones.has(key)) pendientes++;
  }
  return { data: pendientes, isLoading: false, isError, error };
}

export const AUDITORIA_QUERY_KEY = QUERY_KEY;
