/**
 * useAppLogsHealth — Resumen agregado y línea de tiempo de `app_logs`.
 * Consume los RPCs `app_logs_health_summary` y `app_logs_health_timeline`
 * (SECURITY INVOKER, respetan RLS multi-tenant).
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchAppLogsHealthSummary,
  fetchAppLogsHealthTimeline,
  type HealthSummaryRow,
  type HealthTimelinePoint,
} from "@/features/admin/services";

export type { HealthSummaryRow,  };

export interface HealthKpis {
  totalEvents: number;
  totalErrors: number;
  totalWarns: number;
  errorRatePct: number;
  affectedFns: number;
}

export function useAppLogsHealthSummary(hours: number) {
  return useQuery({
    queryKey: queryKeys.appLogs.healthSummary(hours),
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: () => fetchAppLogsHealthSummary(hours),
  });
}

export function useAppLogsHealthTimeline(hours: number, buckets = 24) {
  return useQuery({
    queryKey: queryKeys.appLogs.healthTimeline(hours, buckets),
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: () => fetchAppLogsHealthTimeline(hours, buckets),
  });
}

export function computeKpis(rows: HealthSummaryRow[]): HealthKpis {
  const totalEvents = rows.reduce((s, r) => s + r.total, 0);
  const totalErrors = rows.reduce((s, r) => s + r.errors, 0);
  const totalWarns = rows.reduce((s, r) => s + r.warns, 0);
  return {
    totalEvents,
    totalErrors,
    totalWarns,
    errorRatePct: totalEvents > 0 ? (totalErrors / totalEvents) * 100 : 0,
    affectedFns: rows.filter((r) => r.errors > 0).length,
  };
}
