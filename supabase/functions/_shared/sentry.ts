/**
 * Wrapper de Sentry para edge functions (Deno).
 *
 * Diseño:
 *  - No-op si `SENTRY_DSN_EDGE` no está configurado (no rompe deploys ni tests).
 *  - Inicialización perezosa, una sola vez por isolate.
 *  - No envía payloads del request, sólo metadatos (fn, request_id, status, latency).
 *  - `captureEdgeException` hace `flush(2000)` para garantizar envío antes de
 *    que el isolate se duerma (entornos serverless).
 *
 * Uso típico en cada edge function:
 *
 *   import { initSentryEdge, captureEdgeException } from "../_shared/sentry.ts";
 *   initSentryEdge("parse-cfdi-xml");
 *
 *   Deno.serve(async (req) => {
 *     try { ... } catch (err) {
 *       await captureEdgeException(err, { fn: "parse-cfdi-xml", request_id });
 *       throw err;
 *     }
 *   });
 */
// deno-lint-ignore-file no-explicit-any

type SentryMod = typeof import("npm:@sentry/deno@8");

let sentryPromise: Promise<SentryMod | null> | null = null;
let initializedFor: string | null = null;

// @ts-expect-error Deno global
const DSN = Deno.env.get("SENTRY_DSN_EDGE");
// @ts-expect-error Deno global
const ENV = Deno.env.get("DENO_ENV") ?? Deno.env.get("SUPABASE_ENV") ?? "production";

async function loadSentry(): Promise<SentryMod | null> {
  if (!DSN) return null;
  if (!sentryPromise) {
    sentryPromise = (async () => {
      try {
        const mod = await import("npm:@sentry/deno@8");
        return mod;
      } catch (err) {
        console.error(JSON.stringify({ level: "warn", fn: "sentry-edge", msg: "load_failed", error: String(err) }));
        return null;
      }
    })();
  }
  return sentryPromise;
}

export function initSentryEdge(fnName: string): void {
  if (!DSN) return;
  if (initializedFor === fnName) return;
  initializedFor = fnName;
  // fire-and-forget; las llamadas posteriores hacen await del mismo promise
  void loadSentry().then((Sentry) => {
    if (!Sentry) return;
    try {
      Sentry.init({
        dsn: DSN,
        environment: ENV,
        release: `libre-carga-edge@${fnName}`,
        tracesSampleRate: 0.1,
        defaultIntegrations: false,
      });
      Sentry.setTag("fn", fnName);
      Sentry.setTag("runtime", "deno-edge");
    } catch (err) {
      console.error(JSON.stringify({ level: "warn", fn: "sentry-edge", msg: "init_failed", error: String(err) }));
    }
  });
}

export interface EdgeErrorContext {
  fn: string;
  request_id?: string | null;
  user_id?: string | null;
  organization_id?: string | null;
  status_code?: number | null;
  latency_ms?: number | null;
  extra?: Record<string, unknown>;
}

/**
 * Captura un error en Sentry con tags estructurados y hace flush para garantizar
 * el envío antes de que el isolate termine. No relanza — el caller decide.
 */
export async function captureEdgeException(err: unknown, ctx: EdgeErrorContext): Promise<void> {
  if (!DSN) return;
  const Sentry = await loadSentry();
  if (!Sentry) return;
  try {
    Sentry.withScope((scope: any) => {
      scope.setTag("fn", ctx.fn);
      if (ctx.request_id) scope.setTag("request_id", ctx.request_id);
      if (ctx.user_id) scope.setUser({ id: ctx.user_id });
      if (ctx.organization_id) scope.setTag("organization_id", ctx.organization_id);
      if (ctx.status_code != null) scope.setTag("status_code", String(ctx.status_code));
      if (ctx.latency_ms != null) scope.setExtra("latency_ms", ctx.latency_ms);
      if (ctx.extra) scope.setContext("edge", ctx.extra);
      Sentry.captureException(err);
    });
    await Sentry.flush(2000);
  } catch (e) {
    console.error(JSON.stringify({ level: "warn", fn: "sentry-edge", msg: "capture_failed", error: String(e) }));
  }
}

/**
 * Envuelve un handler de `Deno.serve` agregando captura automática de errores
 * no controlados. Re-lanza el error original para que el caller mantenga su
 * flujo de respuesta existente.
 */
export function wrapEdgeHandler(
  fnName: string,
  handler: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  initSentryEdge(fnName);
  return async (req: Request): Promise<Response> => {
    const request_id =
      req.headers.get("x-request-id") ??
      req.headers.get("x-correlation-id") ??
      null;
    try {
      return await handler(req);
    } catch (err) {
      await captureEdgeException(err, { fn: fnName, request_id });
      throw err;
    }
  };
}
