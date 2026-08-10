/**
 * client-error-log — recibe errores del frontend (ErrorBoundary) y los persiste
 * en `app_logs` con fn='client' mediante la RPC `log_client_error_v1`.
 *
 * Seguridad (12.32.0):
 *  - Usa ANON_KEY + RPC SECURITY DEFINER (no service role en el endpoint).
 *  - La RPC atribuye `auth.uid()` automáticamente cuando el caller envía JWT.
 *  - Rate limit persistente vía RPC `check_ratelimit` (tabla `ratelimit_buckets`).
 *
 * N51 (Ola 4): rate-limit fail-CLOSED (un error de la RPC ya no deja pasar la
 * petición), límite de tamaño de body ANTES de parsear (413) y llave de
 * rate-limit compuesta IP + x-client-info (evita mezclar clientes tras NAT).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { initSentryEdge, captureEdgeException } from "../_shared/sentry.ts";

initSentryEdge("client-error-log");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ClientErrorPayload {
  message?: unknown;
  stack?: unknown;
  component_stack?: unknown;
  route?: unknown;
  user_agent?: unknown;
  app_version?: unknown;
}

/**
 * N51 (Ola 4): límite de tamaño del body. El payload real son 6 strings
 * truncados a ≤8 KB; 64 KB sobra y evita cargar bodies enormes en memoria
 * (antes el truncado ocurría DESPUÉS de parsear todo el body).
 */
export const MAX_BODY_BYTES = 64 * 1024;

// deno-lint-ignore no-explicit-any
type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }> };

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

export function truncate(value: unknown, max: number): string | null {
  if (value == null) return null;
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * N51 (Ola 4): llave de rate-limit compuesta. IP sola es spoofeable/compartida
 * por NATs; combinar con x-client-info (truncado) evita mezclar clientes
 * distintos en el mismo bucket sin perder el propósito del límite.
 */
export function buildRateLimitKey(req: Request): string {
  const ip = getClientIp(req);
  const clientInfo = (req.headers.get("x-client-info") ?? "desconocido").slice(0, 100);
  return `client-error-log:${ip}:${clientInfo}`;
}

function jsonResponse(body: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

/**
 * N51 (Ola 4): lógica principal extraída para poder testearla con un cliente
 * RPC simulado (sin levantar `createClient` real ni la red).
 */
export async function handleClientErrorLog(
  req: Request,
  client: RpcClient,
  requestId: string,
): Promise<Response> {
  // N51 (Ola 4): rechazar bodies enormes ANTES de leer el stream.
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "payload_too_large" }, 413);
  }

  const { data: rl, error: rlError } = await client.rpc("check_ratelimit", {
    p_key: buildRateLimitKey(req),
    p_window_seconds: 60,
    p_max: 20,
  });
  // N51 (Ola 4): fail-CLOSED — antes un error de la RPC dejaba pasar la
  // petición (rate limit decorativo justo cuando la BD está en problemas).
  if (rlError) {
    console.error("client-error-log ratelimit rpc failed:", rlError.message);
    await captureEdgeException(new Error(`check_ratelimit failed: ${rlError.message}`), {
      fn: "client-error-log",
      status_code: 503,
      request_id: requestId,
    });
    return jsonResponse({ error: "rate_limit_unavailable" }, 503, { "Retry-After": "30" });
  }
  const rlResult = rl as { ok?: boolean; retry_after?: number } | null;
  if (rlResult && rlResult.ok === false) {
    return jsonResponse(
      { error: "rate_limited" },
      429,
      { "Retry-After": String(rlResult.retry_after ?? 60) },
    );
  }

  let body: ClientErrorPayload;
  try {
    // N51 (Ola 4): red de seguridad para requests chunked sin Content-Length:
    // leer texto, validar largo y parsear manualmente.
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: "payload_too_large" }, 413);
    }
    body = JSON.parse(raw) as ClientErrorPayload;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const { error } = await client.rpc("log_client_error_v1", {
    p_message: truncate(body.message, 1000) ?? "(sin mensaje)",
    p_stack: truncate(body.stack, 8000),
    p_component_stack: truncate(body.component_stack, 4000),
    p_route: truncate(body.route, 500),
    p_user_agent: truncate(body.user_agent, 500),
    p_app_version: truncate(body.app_version, 50),
    p_request_id: requestId,
  });

  if (error) {
    console.error("client-error-log rpc failed:", error.message);
    await captureEdgeException(new Error(`log_client_error_v1 failed: ${error.message}`), {
      fn: "client-error-log",
      status_code: 500,
      request_id: requestId,
    });
    return jsonResponse({ error: "insert_failed" }, 500);
  }

  return jsonResponse({ ok: true, request_id: requestId }, 200);
}

Deno.serve(async (req: Request) => {
  // 13.114.19: try/catch externo para que errores en `createClient`,
  // `check_ratelimit` RPC o cualquier excepción imprevista lleguen a Sentry
  // (antes sólo se reportaba el fallo de `log_client_error_v1`).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const headerReqId =
    req.headers.get("x-request-id") ?? req.headers.get("x-correlation-id");
  const requestId =
    headerReqId && UUID_RE.test(headerReqId) ? headerReqId : crypto.randomUUID();

  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return jsonResponse({ error: "method_not_allowed" }, 405);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anonKey) {
      return jsonResponse({ error: "config_missing" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    const client = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: authHeader ? { headers: { Authorization: authHeader } } : {},
    });

    return await handleClientErrorLog(req, client, requestId);
  } catch (err) {
    console.error("client-error-log unhandled:", err);
    await captureEdgeException(err, {
      fn: "client-error-log",
      status_code: 500,
      request_id: requestId,
      extra: { phase: "handler_root" },
    });
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
