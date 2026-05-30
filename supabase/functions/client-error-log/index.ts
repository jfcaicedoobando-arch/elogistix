/**
 * client-error-log — recibe errores del frontend (ErrorBoundary) y los persiste
 * en `app_logs` con fn='client' para que aparezcan en /admin/diagnostico.
 *
 * Seguridad (12.23.1):
 *  - Si llega `Authorization: Bearer ...`, se valida la firma con
 *    `auth.getClaims(token)`. Sólo entonces se atribuye el `user_id`. Tokens
 *    inválidos no fallan el request (endpoint es público porque un crash
 *    puede ocurrir pre-auth), pero `user_id` queda en null.
 *  - Rate limit in-memory por IP (20 req/min). Best-effort; mitiga abuso
 *    casual y previene el disparo del cron `detectar_alertas_app_logs`.
 *    Para protección dura habría que mover a Upstash/Redis.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

// ──────── Rate limit in-memory ────────
const RL_WINDOW_MS = 60_000;
const RL_MAX = 20;
const RL_PURGE_MS = 5 * 60_000;
interface RateBucket { count: number; windowStart: number }
const rateMap = new Map<string, RateBucket>();

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

export function checkRateLimit(ip: string, now = Date.now()): { ok: boolean; retryAfter: number } {
  // Purga perezosa
  if (rateMap.size > 1000) {
    for (const [k, v] of rateMap) {
      if (now - v.windowStart > RL_PURGE_MS) rateMap.delete(k);
    }
  }
  const bucket = rateMap.get(ip);
  if (!bucket || now - bucket.windowStart > RL_WINDOW_MS) {
    rateMap.set(ip, { count: 1, windowStart: now });
    return { ok: true, retryAfter: 0 };
  }
  bucket.count++;
  if (bucket.count > RL_MAX) {
    const retryAfter = Math.ceil((RL_WINDOW_MS - (now - bucket.windowStart)) / 1000);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }
  return { ok: true, retryAfter: 0 };
}

async function verifyUserId(req: Request, supabaseUrl: string, anonKey: string): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  try {
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: auth } },
    });
    const { data, error } = await anonClient.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return typeof data.claims.sub === "string" ? data.claims.sub : null;
  } catch {
    return null;
  }
}

export function truncate(value: unknown, max: number): string | null {
  if (value == null) return null;
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > max ? s.slice(0, max) : s;
}

// @ts-expect-error Deno global
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate limit
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(rl.retryAfter),
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

  const message = truncate(body.message, 1000) ?? "(sin mensaje)";
  const stack = truncate(body.stack, 8000);
  const componentStack = truncate(body.component_stack, 4000);
  const route = truncate(body.route, 500);
  const userAgent = truncate(body.user_agent, 500);
  const appVersion = truncate(body.app_version, 50);

  // @ts-expect-error Deno global
  const url = Deno.env.get("SUPABASE_URL");
  // @ts-expect-error Deno global
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  // @ts-expect-error Deno global
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? anonKey;
  if (!url || !serviceKey || !anonKey) {
    return new Response(JSON.stringify({ error: "config_missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = await verifyUserId(req, url, anonKey);
  const client = createClient(url, serviceKey, { auth: { persistSession: false } });
  const requestId =
    req.headers.get("x-request-id") ??
    req.headers.get("x-correlation-id") ??
    crypto.randomUUID();

  try {
    await client.from("app_logs").insert({
      level: "error",
      fn: "client",
      msg: message,
      request_id: requestId,
      user_id: userId,
      status_code: 500,
      latency_ms: null,
      payload: {
        stack,
        component_stack: componentStack,
        route,
        user_agent: userAgent,
        app_version: appVersion,
      },
    });
  } catch (err) {
    console.error("client-error-log insert failed:", err);
    return new Response(JSON.stringify({ error: "insert_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, request_id: requestId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
