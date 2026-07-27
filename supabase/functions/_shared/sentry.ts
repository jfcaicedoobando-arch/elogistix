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

/** F5 (13.65.0): límite duro para `extra` y evitar 413 en Sentry (cap ~128 KB
 *  por evento). Si el payload se serializa por encima de este umbral lo
 *  recortamos a un placeholder; los detalles relevantes deberían ir en `tags`. */
const MAX_EXTRA_BYTES = 32_000;

/** 13.114.18: lista negra de claves cuyo valor se redacta antes de enviar a
 *  Sentry. Coincide case-insensitive y por substring para cubrir variantes
 *  comunes (`api_key`, `apiKey`, `accessToken`, etc.). */
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /api[_-]key/i,
  /authorization/i,
  /cookie/i,
  /bearer/i,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key));
}

function scrubExtraDeep(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => scrubExtraDeep(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitiveKey(k) ? "[Filtered]" : scrubExtraDeep(v, depth + 1);
  }
  return out;
}

function truncatedExtra(extra: Record<string, unknown>): Record<string, unknown> {
  const scrubbed = scrubExtraDeep(extra) as Record<string, unknown>;
  try {
    const serialized = JSON.stringify(scrubbed);
    if (serialized.length <= MAX_EXTRA_BYTES) return scrubbed;
    return {
      _truncated: true,
      _original_bytes: serialized.length,
      preview: serialized.slice(0, 2000),
    };
  } catch {
    return { _unserializable: true };
  }
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
    Sentry.withScope((scope: { setTag: (k: string, v: string) => void; setUser: (u: { id: string }) => void; setExtra: (k: string, v: unknown) => void; setContext: (k: string, v: Record<string, unknown>) => void }) => {
      scope.setTag("fn", ctx.fn);
      if (ctx.request_id) scope.setTag("request_id", ctx.request_id);
      if (ctx.user_id) scope.setUser({ id: ctx.user_id });
      if (ctx.organization_id) scope.setTag("organization_id", ctx.organization_id);
      if (ctx.status_code != null) scope.setTag("status_code", String(ctx.status_code));
      if (ctx.latency_ms != null) scope.setExtra("latency_ms", ctx.latency_ms);
      if (ctx.extra) scope.setContext("edge", truncatedExtra(ctx.extra));
      Sentry.captureException(err);
    });
    await Sentry.flush(2000);
  } catch (e) {
    console.error(JSON.stringify({ level: "warn", fn: "sentry-edge", msg: "capture_failed", error: String(e) }));
  }
}

/**
 * Fase 7 · Observabilidad. Envía un mensaje (no un error) a Sentry con tags
 * estructurados. Útil para señales tipo "webhook duplicado", "cron sin datos",
 * etc. — algo que queremos vigilar pero que no es una excepción.
 */
export async function captureEdgeMessage(
  message: string,
  level: "info" | "warning" | "error",
  ctx: EdgeErrorContext,
): Promise<void> {
  if (!DSN) return;
  const Sentry = await loadSentry();
  if (!Sentry) return;
  try {
    Sentry.withScope((scope: { setTag: (k: string, v: string) => void; setUser: (u: { id: string }) => void; setExtra: (k: string, v: unknown) => void; setContext: (k: string, v: Record<string, unknown>) => void; setLevel: (l: string) => void }) => {
      scope.setLevel(level);
      scope.setTag("fn", ctx.fn);
      if (ctx.request_id) scope.setTag("request_id", ctx.request_id);
      if (ctx.organization_id) scope.setTag("organization_id", ctx.organization_id);
      if (ctx.extra) scope.setContext("edge", truncatedExtra(ctx.extra));
      Sentry.captureMessage(message);
    });
    await Sentry.flush(2000);
  } catch (e) {
    console.error(JSON.stringify({ level: "warn", fn: "sentry-edge", msg: "capture_msg_failed", error: String(e) }));
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

/**
 * 13.320.0 (audit Sentry Batch 1.a) — Sentry Crons Monitoring.
 *
 * Envuelve un handler de edge function programado (cron / pg_cron) con
 * check-ins de Sentry Crons. Si el job no manda check-in en la ventana
 * esperada, Sentry dispara una alerta "missed check-in".
 *
 * Opt-in por función vía env `SENTRY_CRON_MONITOR_SLUG` — si no está seteada,
 * el wrapper se comporta idéntico a `wrapEdgeHandler` (no-op de monitoreo).
 *
 * Uso típico:
 *   Deno.serve(withCronMonitor("rep-retry-nocturno", "rep-retry-nocturno", handler, {
 *     schedule: { type: "crontab", value: "0 12 * * *" },
 *     checkinMargin: 5,   // minutos
 *     maxRuntime: 30,     // minutos
 *   }));
 */
export interface CronMonitorConfig {
  schedule: { type: "crontab"; value: string } | { type: "interval"; value: number; unit: "minute" | "hour" | "day" };
  checkinMargin?: number;
  maxRuntime?: number;
  timezone?: string;
}

export function withCronMonitor(
  fnName: string,
  monitorSlug: string,
  handler: (req: Request) => Promise<Response> | Response,
  monitorConfig: CronMonitorConfig,
): (req: Request) => Promise<Response> {
  initSentryEdge(fnName);
  const wrapped = wrapEdgeHandler(fnName, handler);
  return async (req: Request): Promise<Response> => {
    if (!DSN) return wrapped(req);
    const Sentry = await loadSentry();
    if (!Sentry) return wrapped(req);
    // `withMonitor` maneja check-in de inicio, éxito y error automáticamente.
    return await (Sentry as unknown as {
      withMonitor: <T>(slug: string, cb: () => Promise<T>, cfg: CronMonitorConfig) => Promise<T>;
    }).withMonitor(monitorSlug, () => Promise.resolve(wrapped(req)), monitorConfig);
  };
}
