/**
 * Rate limit persistente fail-CLOSED, compartido por endpoints públicos.
 *
 * EC-3: extraído del patrón que ya usaban `demo-access` y `client-error-log`
 * para que cualquier función pública lo consuma sin duplicar la lógica.
 * Si la RPC falla, se corta con 503 (nunca se "abre" el endpoint).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse } from "./response.ts";
import { captureEdgeException } from "./sentry.ts";

/** IP del solicitante (best-effort: XFF es falsificable, de ahí el tope global). */
export function ipDeRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

interface ReglaRateLimit {
  key: string;
  windowSeconds: number;
  max: number;
  retryAfterFallback?: number;
}

async function aplicarRegla(
  client: SupabaseClient,
  fn: string,
  regla: ReglaRateLimit,
): Promise<Response | null> {
  const { data, error } = await client.rpc("check_ratelimit", {
    p_key: regla.key,
    p_window_seconds: regla.windowSeconds,
    p_max: regla.max,
  });
  if (error) {
    await captureEdgeException(new Error(`check_ratelimit failed: ${error.message}`), {
      fn,
      status_code: 503,
    });
    return jsonResponse({ error: "rate_limit_unavailable", code: "rate_limit_unavailable" }, 503, {
      "Retry-After": "30",
    });
  }
  const res = data as { ok?: boolean; retry_after?: number } | null;
  if (res?.ok === false) {
    return jsonResponse({ error: "rate_limited", code: "rate_limited" }, 429, {
      "Retry-After": String(res.retry_after ?? regla.retryAfterFallback ?? 60),
    });
  }
  return null;
}

/**
 * Aplica por-IP y luego el tope global. Devuelve una `Response` cuando hay que
 * cortar, o `null` si se puede continuar.
 */
export async function limitarPeticionesPublicas(
  client: SupabaseClient,
  req: Request,
  opts: {
    fn: string;
    porIp: { windowSeconds: number; max: number };
    global: { windowSeconds: number; max: number };
  },
): Promise<Response | null> {
  const porIp = await aplicarRegla(client, opts.fn, {
    key: `${opts.fn}:${ipDeRequest(req)}`,
    windowSeconds: opts.porIp.windowSeconds,
    max: opts.porIp.max,
  });
  if (porIp) return porIp;

  return await aplicarRegla(client, opts.fn, {
    key: `${opts.fn}:global`,
    windowSeconds: opts.global.windowSeconds,
    max: opts.global.max,
    retryAfterFallback: 300,
  });
}
