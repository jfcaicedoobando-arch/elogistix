/**
 * CORS para edge functions.
 *
 * - `corsHeaders`: wildcard `*`. Sólo para endpoints **públicos por diseño**
 *   (ej. `tracking-public`, `exchange-rates`).
 * - `buildCors(req)`: refleja el `Origin` sólo si está en la whitelist; en
 *   caso contrario devuelve `"null"`. Úsalo en TODA edge function que
 *   requiera JWT (user-management, parse-csf, auditoria-*).
 *
 * Whitelist: dominios `*.lovable.app` / `*.lovableproject.com` (preview +
 * published) + dominios custom de producción (Libre Carga) + localhost dev.
 *
 * Headers `x-supabase-client-*` requeridos por SDK v2.95+.
 */
// 13.114.13: agregados `sentry-trace` y `baggage`. En producción
// (`librecarga.com`) Sentry adjunta automáticamente esos headers a fetches
// que matchean `tracePropagationTargets` (incluye `*.supabase.co/functions/v1`).
// Sin permitirlos en el preflight, el navegador cancelaba el POST y el
// edge function nunca recibía la invocación — síntoma: `FunctionsFetchError`
// con `lastStatus: null` sólo en el dominio custom (preview no lo dispara).
const ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, sentry-trace, baggage, x-organization-id";

const ALLOW_METHODS = "GET, POST, OPTIONS";
const MAX_AGE = "86400";

const ALLOWED_HOST_SUFFIXES = [".lovable.app", ".lovableproject.com"];
const ALLOWED_EXACT = new Set([
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
  // Dominios custom de producción (Libre Carga)
  "https://librecarga.com",
  "https://www.librecarga.com",
  "https://elogistix.lovable.app",
]);

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_EXACT.has(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:") return false;
    return ALLOWED_HOST_SUFFIXES.some((s) => hostname.endsWith(s));
  } catch {
    return false;
  }
}

/** Wildcard CORS — sólo para endpoints públicos por diseño. */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": ALLOW_HEADERS,
  "Access-Control-Allow-Methods": ALLOW_METHODS,
};

/** CORS con whitelist — usar en endpoints autenticados. */
export function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = isAllowedOrigin(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Max-Age": MAX_AGE,
    "Vary": "Origin",
  };
}

/** Preflight para endpoints públicos (wildcard). */
export function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

/** Preflight para endpoints autenticados (whitelist). */
export function handlePreflightStrict(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCors(req) });
  }
  return null;
}
