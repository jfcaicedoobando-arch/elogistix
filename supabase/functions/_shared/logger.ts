/**
 * Logger estructurado para edge functions (B.1 / 8.171.0).
 *
 * Escribe en `console.log` (visible en Supabase function logs) y, en
 * paralelo, en la tabla `public.app_logs` para poder consultar desde la UI
 * `/admin/diagnostico`. Falla en silencio si la inserción rompe (no queremos
 * que un fallo de logging derribe el handler).
 *
 * Uso típico:
 *
 *   const log = createLogger(req, 'parse-csf');
 *   const t0 = performance.now();
 *   try {
 *     // ... lógica
 *     log.info('csf parseado', { rfc, latency_ms: performance.now() - t0 });
 *     return jsonResponse(out);
 *   } catch (err) {
 *     log.error('falló parseo', { error: String(err), latency_ms: performance.now() - t0 });
 *     return errorResponse('csf_parse_failed', 500);
 *   }
 */
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Level = "info" | "warn" | "error";

export interface LogContext {
  request_id?: string | null;
  user_id?: string | null;
  organization_id?: string | null;
  status_code?: number | null;
  latency_ms?: number | null;
  payload?: Record<string, unknown> | null;
}

export interface Logger {
  info: (msg: string, ctx?: LogContext) => void;
  warn: (msg: string, ctx?: LogContext) => void;
  error: (msg: string, ctx?: LogContext) => void;
  /** Marca el final del handler con status_code y latencia automática. */
  finish: (status_code: number, msg?: string, ctx?: LogContext) => void;
}

/**
 * Intenta extraer el `user_id` del JWT del request sin verificar firma
 * (solo decodificación). Sirve como pista; no para autorización.
 */
function tryExtractUserId(req: Request): string | null {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token || !token.includes(".")) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

let cachedClient: ReturnType<typeof createClient> | null = null;
function getServiceClient() {
  if (cachedClient) return cachedClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

async function writeLog(
  level: Level,
  fn: string,
  msg: string,
  baseCtx: LogContext,
  overrideCtx?: LogContext,
): Promise<void> {
  const ctx = { ...baseCtx, ...(overrideCtx ?? {}) };
  // console first — visible en Supabase logs aunque la BD falle
  const line = {
    level,
    fn,
    msg,
    ...ctx,
  };
  if (level === "error") console.error(JSON.stringify(line));
  else if (level === "warn") console.warn(JSON.stringify(line));
  else console.log(JSON.stringify(line));

  const client = getServiceClient();
  if (!client) return;
  try {
    await client.from("app_logs").insert({
      level,
      fn,
      msg,
      request_id: ctx.request_id ?? null,
      user_id: ctx.user_id ?? null,
      organization_id: ctx.organization_id ?? null,
      status_code: ctx.status_code ?? null,
      latency_ms: ctx.latency_ms ?? null,
      payload: ctx.payload ?? null,
    });
  } catch (err) {
    // nunca propagar: el logging no debe romper el handler
    console.error(JSON.stringify({ level: "error", fn: "logger", msg: "writeLog failed", error: String(err) }));
  }
}

/**
 * Crea un logger atado al request actual. Captura `user_id` desde el JWT y
 * mide latencia desde la creación si se llama `finish()`.
 */
export function createLogger(req: Request, fn: string): Logger {
  const t0 = performance.now();
  const requestId =
    req.headers.get("x-request-id") ??
    req.headers.get("x-correlation-id") ??
    crypto.randomUUID();
  const userId = tryExtractUserId(req);
  const base: LogContext = { request_id: requestId, user_id: userId };

  return {
    info: (msg, ctx) => void writeLog("info", fn, msg, base, ctx),
    warn: (msg, ctx) => void writeLog("warn", fn, msg, base, ctx),
    error: (msg, ctx) => void writeLog("error", fn, msg, base, ctx),
    finish: (status_code, msg = "request finished", ctx) => {
      const latency_ms = Math.round(performance.now() - t0);
      const level: Level = status_code >= 500 ? "error" : status_code >= 400 ? "warn" : "info";
      void writeLog(level, fn, msg, base, { ...(ctx ?? {}), status_code, latency_ms });
    },
  };
}
