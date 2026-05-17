/**
 * client-error-log — recibe errores del frontend (ErrorBoundary) y los persiste
 * en `app_logs` con fn='client' para que aparezcan en /admin/diagnostico y
 * disparen el detector de alertas si se repiten.
 *
 * verify_jwt = false (defecto Lovable). Aceptamos requests anónimos porque un
 * crash puede ocurrir antes de obtener sesión válida; usamos el JWT si está
 * presente pero no lo exigimos.
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

function truncate(value: unknown, max: number): string | null {
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
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) {
    return new Response(JSON.stringify({ error: "config_missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  const userId = tryExtractUserId(req);
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
