import { scrubTelemetryData, scrubTelemetryText } from "./scrubTelemetryData.ts";

export interface EdgeErrorContext {
  fn: string;
  request_id?: string | null;
  user_id?: string | null;
  organization_id?: string | null;
  status_code?: number | null;
  latency_ms?: number | null;
  extra?: Record<string, unknown>;
}

interface Scope {
  setTag: (key: string, value: string) => unknown;
  setUser: (user: { id: string }) => unknown;
  setContext: (key: string, value: Record<string, unknown>) => unknown;
}

export function applyEdgeContext(scope: Scope, ctx: EdgeErrorContext): void {
  scope.setTag("fn", scrubTelemetryText(ctx.fn));
  if (ctx.request_id) scope.setTag("request_id", scrubTelemetryText(ctx.request_id));
  if (ctx.user_id) scope.setUser({ id: ctx.user_id });
  if (ctx.organization_id) scope.setTag("organization_id", ctx.organization_id);
  if (ctx.status_code != null) scope.setTag("status_code", String(ctx.status_code));
  const clean = scrubTelemetryData({ ...ctx.extra, latency_ms: ctx.latency_ms }) as Record<string, unknown>;
  const size = JSON.stringify(clean).length;
  scope.setContext("edge", size <= 32_000 ? clean : { _truncated: true, _original_bytes: size });
}

export function cleanEdgeException(error: unknown): Error {
  const raw = error as { message?: unknown; code?: unknown; name?: unknown; stack?: unknown };
  const message = typeof raw?.message === "string" ? raw.message
    : typeof error === "string" ? error : "unknown error";
  const clean = new Error(scrubTelemetryText(message), { cause: scrubTelemetryData(error) });
  if (typeof raw?.name === "string") clean.name = raw.name;
  if (typeof raw?.stack === "string") clean.stack = scrubTelemetryText(raw.stack);
  if (typeof raw?.code === "string") Object.assign(clean, { code: raw.code });
  return clean;
}
