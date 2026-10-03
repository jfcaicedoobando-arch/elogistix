/** Scoped, bounded Sentry reporting for Supabase Edge. No DSN = no-op. */
import { loadSentryEdge } from "./sentryRuntime.ts";
import { applyEdgeContext, cleanEdgeException, type EdgeErrorContext } from "./sentryContext.ts";
import { scrubTelemetryText } from "./scrubTelemetryData.ts";

export type { EdgeErrorContext } from "./sentryContext.ts";
export const scrubExceptionMessage = scrubTelemetryText;

export function initSentryEdge(_fnName: string): void {
  void loadSentryEdge();
}

export function debeReportarStatus(status: number): boolean {
  return status !== 401 && status >= 400;
}

export async function captureEdgeException(error: unknown, ctx: EdgeErrorContext): Promise<void> {
  const sdk = await loadSentryEdge();
  if (!sdk) return;
  try {
    sdk.withScope((scope) => {
      applyEdgeContext(scope, ctx);
      sdk.captureException(cleanEdgeException(error));
    });
    await sdk.flush(2000);
  } catch {
    console.warn("[sentry-edge] capture failed");
  }
}

export async function captureEdgeMessage(
  message: string, level: "info" | "warning" | "error", ctx: EdgeErrorContext,
): Promise<void> {
  const sdk = await loadSentryEdge();
  if (!sdk) return;
  try {
    sdk.withScope((scope) => {
      applyEdgeContext(scope, ctx);
      scope.setLevel(level);
      sdk.captureMessage(scrubTelemetryText(message));
    });
    await sdk.flush(2000);
  } catch {
    console.warn("[sentry-edge] message capture failed");
  }
}

export function wrapEdgeHandler(
  fnName: string, handler: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  initSentryEdge(fnName);
  return async (req) => {
    const sdk = await loadSentryEdge();
    const requestId = req.headers.get("x-request-id") ?? req.headers.get("x-correlation-id") ?? crypto.randomUUID();
    const run = async () => {
      try { return await handler(req); }
      catch (error) {
        await captureEdgeException(error, { fn: fnName, request_id: requestId });
        throw error;
      }
    };
    if (!sdk) return run();
    return sdk.withIsolationScope(async (scope) => {
      applyEdgeContext(scope, { fn: fnName, request_id: requestId });
      sdk.setAttributes({ fn: fnName, request_id: requestId });
      try {
        return await sdk.continueTrace({
          sentryTrace: req.headers.get("sentry-trace") ?? undefined,
          baggage: req.headers.get("baggage") ?? undefined,
        }, () => sdk.startSpan({ name: fnName, op: "http.server",
          attributes: { "http.request.method": req.method } }, async (span) => {
          const response = await run();
          span.setAttribute("http.response.status_code", response.status);
          if (response.status >= 500) span.setStatus({ code: 2 });
          return response;
        }));
      } finally {
        // Includes the finished request span, not only captured exceptions.
        await sdk.flush(2000).catch(() => undefined);
      }
    });
  };
}

export interface CronMonitorConfig {
  schedule: { type: "crontab"; value: string } | { type: "interval"; value: number; unit: "minute" | "hour" | "day" };
  checkinMargin?: number;
  maxRuntime?: number;
  timezone?: string;
}

export function withCronMonitor(
  fnName: string, monitorSlug: string, handler: (req: Request) => Promise<Response> | Response,
  monitorConfig: CronMonitorConfig,
): (req: Request) => Promise<Response> {
  const wrapped = wrapEdgeHandler(fnName, handler);
  return async (req) => {
    const sdk = await loadSentryEdge();
    // Comma-separated allowlist: opt in by actual slug, never create all monitors.
    const enabled = (Deno.env.get("SENTRY_CRON_MONITOR_SLUG") ?? "").split(",").map((s) => s.trim());
    if (!sdk || !enabled.includes(monitorSlug)) return wrapped(req);
    return sdk.withIsolationScope(async () => {
      const id = sdk.captureCheckIn({ monitorSlug, status: "in_progress" }, monitorConfig);
      let status: "ok" | "error" = "error";
      try {
        const response = await wrapped(req);
        status = response.status >= 500 ? "error" : "ok";
        return response;
      } finally {
        // Preserve HTTP responses and exceptions; observability does not rewrite the workflow.
        sdk.captureCheckIn({ checkInId: id, monitorSlug, status });
        await sdk.flush(2000).catch(() => undefined);
      }
    });
  };
}
