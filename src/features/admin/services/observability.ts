/**
 * Servicio Admin — Alertas de sistema y app logs.
 * Lectura RLS-aware (super_admin ve todo, admin org ve su scope).
 */
import { supabase } from "@/integrations/supabase/client";
import { ilikePattern } from "@/lib/search/ilike";
import type { Database } from "@/integrations/supabase/types";

export interface AlertaSistema {
  id: string;
  severity: string;
  source: string;
  message: string;
  payload: Record<string, unknown> | null;
  dedupe_key: string | null;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

export async function fetchAlertasPendingCount(): Promise<number> {
  const { data, error } = await supabase.rpc("alertas_sistema_pending_count");
  if (error) throw error;
  return Number(data ?? 0);
}

export async function fetchAlertasSistema(includeAcknowledged = false): Promise<AlertaSistema[]> {
  let q = supabase
    .from("alertas_sistema")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!includeAcknowledged) q = q.is("acknowledged_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AlertaSistema[];
}

export async function reconocerAlerta(input: { id: string; userId: string | null }): Promise<void> {
  const { error } = await supabase
    .from("alertas_sistema")
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: input.userId })
    .eq("id", input.id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// App logs
// ---------------------------------------------------------------------------

export type AppLogLevel = "info" | "warn" | "error";
export type AppLogRow = Database["public"]["Tables"]["app_logs"]["Row"];

export interface AppLogsQueryInput {
  page: number;
  pageSize: number;
  level: AppLogLevel | "todos";
  fn: string | "todos";
  search: string;
  from: string | null;
  to: string | null;
}

export interface AppLogsQueryResult {
  rows: AppLogRow[];
  total: number;
}

export async function fetchAppLogs(args: AppLogsQueryInput): Promise<AppLogsQueryResult> {
  const { page, pageSize, level, fn, search, from, to } = args;
  let q = supabase
    .from("app_logs")
    .select("*", { count: "exact" })
    .order("ts", { ascending: false });
  if (level !== "todos") q = q.eq("level", level);
  if (fn !== "todos") q = q.eq("fn", fn);
  if (search.trim()) q = q.ilike("msg", ilikePattern(search));
  if (from) q = q.gte("ts", `${from}T00:00:00.000Z`);
  if (to) q = q.lte("ts", `${to}T23:59:59.999Z`);
  const fromIdx = (page - 1) * pageSize;
  q = q.range(fromIdx, fromIdx + pageSize - 1);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as AppLogRow[], total: count ?? 0 };
}

export async function fetchAppLogsFnList(): Promise<string[]> {
  const { data, error } = await supabase
    .from("app_logs")
    .select("fn")
    .order("fn", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  (data ?? []).forEach((r) => set.add(r.fn));
  return Array.from(set).sort();
}

// ---------------------------------------------------------------------------
// App logs health (RPCs)
// ---------------------------------------------------------------------------

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

export async function fetchAppLogsHealthSummary(hours: number): Promise<HealthSummaryRow[]> {
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
}

export async function fetchAppLogsHealthTimeline(
  hours: number,
  buckets = 24,
): Promise<HealthTimelinePoint[]> {
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
}
