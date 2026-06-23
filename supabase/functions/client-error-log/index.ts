/**
 * client-error-log — recibe errores del frontend (ErrorBoundary) y los persiste
 * en `app_logs` con fn='client' mediante la RPC `log_client_error_v1`.
 *
 * Seguridad (12.32.0):
 *  - Usa ANON_KEY + RPC SECURITY DEFINER (no service role en el endpoint).
 *  - La RPC atribuye `auth.uid()` automáticamente cuando el caller envía JWT.
 *  - Rate limit persistente vía RPC `check_ratelimit` (tabla `ratelimit_buckets`).
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
      return new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anonKey) {
      return new Response(JSON.stringify({ error: "config_missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const client = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: authHeader ? { headers: { Authorization: authHeader } } : {},
    });

    // Rate limit persistente
    const ip = getClientIp(req);
    const { data: rl } = await client.rpc("check_ratelimit", {
      p_key: `client-error-log:${ip}`,
      p_window_seconds: 60,
      p_max: 20,
    });
    const rlResult = rl as { ok?: boolean; retry_after?: number } | null;
    if (rlResult && rlResult.ok === false) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(rlResult.retry_after ?? 60),
        },
      });
    }

    let body: ClientErrorPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "insert_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, request_id: requestId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("client-error-log unhandled:", err);
    await captureEdgeException(err, {
      fn: "client-error-log",
      status_code: 500,
      request_id: requestId,
      extra: { phase: "handler_root" },
    });
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
