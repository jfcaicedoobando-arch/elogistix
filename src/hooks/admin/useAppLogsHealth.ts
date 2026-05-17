/**
 * useAppLogsHealth — Resumen agregado y línea de tiempo de `app_logs`.
 *
 * Consume los RPCs `app_logs_health_summary` y `app_logs_health_timeline`
 * (SECURITY INVOKER, respetan RLS multi-tenant). Usado por el panel de salud
 * en `/admin/diagnostico`.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HealthSummaryRow {
  fn: string;
  total: number;
  errors: number;
  warns: number;
  p50_ms: number | null;
  p95_ms: number | null;
  last_ts: string | null;
  last_error_ts: string | null;
}

export interface HealthTimelinePoint {
  bucket: string;
  total: number;
  errors: number;
  warns: number;
}

export interface HealthKpis {
  totalEvents: number;
  totalErrors: number;
  totalWarns: number;
  errorRatePct: number;
  affectedFns: number;
}

export function useAppLogsHealthSummary(hours: number) {
  return useQuery({
    queryKey: ["app_logs_health_summary", hours],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<HealthSummaryRow[]> => {
      const { data, error } = await supabase.rpc("app_logs_health_summary", { p_hours: hours });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        fn: r.fn,
        total: Number(r.total ?? 0),
        errors: Number(r.errors ?? 0),
        warns: Number(r.warns ?? 0),
        p50_ms: r.p50_ms === null ? null : Number(r.p50_ms),
        p95_ms: r.p95_ms === null ? null : Number(r.p95_ms),
        last_ts: r.last_ts,
        last_error_ts: r.last_error_ts,
      }));
    },
  });
}

export function useAppLogsHealthTimeline(hours: number, buckets = 24) {
  return useQuery({
    queryKey: ["app_logs_health_timeline", hours, buckets],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<HealthTimelinePoint[]> => {
      const { data, error } = await supabase.rpc("app_logs_health_timeline", {
        p_hours: hours,
        p_buckets: buckets,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((p) => ({
        bucket: p.bucket,
        total: Number(p.total ?? 0),
        errors: Number(p.errors ?? 0),
        warns: Number(p.warns ?? 0),
      }));
    },
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
