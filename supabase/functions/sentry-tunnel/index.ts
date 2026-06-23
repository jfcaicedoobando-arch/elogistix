/**
 * sentry-tunnel — Reenvía envelopes de Sentry desde el browser hacia el
 * ingest oficial (`*.ingest.sentry.io`) para evitar bloqueadores de anuncios
 * (uBlock/AdGuard suelen bloquear ese dominio en bruto, perdiendo eventos).
 *
 * Protocolo Sentry "tunnel":
 *  1. El SDK envía el envelope completo (NDJSON binario) al endpoint tunnel.
 *  2. La primera línea es JSON con el header del envelope; incluye `dsn`.
 *  3. Validamos que el host del DSN sea uno de los permitidos (whitelist).
 *  4. Reenviamos el body tal cual a `https://{host}/api/{projectId}/envelope/`.
 *
 * Seguridad: NO loggeamos el payload (privacidad). Sólo metadatos en error.
 * `verify_jwt = false` — los reportes pre-login deben pasar.
 */
// deno-lint-ignore-file no-explicit-any

const ALLOWED_HOSTS = new Set([
  // DSN público del proyecto frontend (elogistix/javascript-react).
  "o4511415732404224.ingest.us.sentry.io",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sentry-auth",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * 13.114.17: rate-limit en memoria por IP para evitar abuso del túnel.
 * Cada isolate mantiene su ventana deslizante de 60 segundos; un atacante con
 * DSN válido necesitaría coordinar muchas IPs para drenar la cuota Sentry.
 *
 * Límite por defecto: 60 requests / minuto / IP. Devuelve 429 al exceder.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const rateBuckets = new Map<string, number[]>();

function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function checkRateLimit(ip: string, now: number = Date.now()): boolean {
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const bucket = (rateBuckets.get(ip) ?? []).filter((t) => t > cutoff);
  if (bucket.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(ip, bucket);
    return false;
  }
  bucket.push(now);
  rateBuckets.set(ip, bucket);
  // GC barato: si crecemos demasiado, limpiar IPs sin actividad reciente.
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (v.length === 0 || v[v.length - 1] < cutoff) rateBuckets.delete(k);
    }
  }
  return true;
}


interface EnvelopeHeader {
  dsn?: string;
  [k: string]: unknown;
}

/** Parsea el header del envelope (primera línea NDJSON) y extrae host + projectId. */
export function parseEnvelopeDsn(firstLine: string): { host: string; projectId: string } | null {
  let header: EnvelopeHeader;
  try {
    header = JSON.parse(firstLine);
  } catch {
    return null;
  }
  if (!header.dsn || typeof header.dsn !== "string") return null;
  try {
    const url = new URL(header.dsn);
    const projectId = url.pathname.replace(/^\/+/, "").split("/")[0];
    if (!projectId) return null;
    return { host: url.host, projectId };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405, headers: corsHeaders });
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return new Response("rate_limited", { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } });
  }


  try {
    const body = await req.text();
    const firstNewline = body.indexOf("\n");
    if (firstNewline === -1) {
      return new Response("invalid_envelope", { status: 400, headers: corsHeaders });
    }
    const parsed = parseEnvelopeDsn(body.slice(0, firstNewline));
    if (!parsed) {
      return new Response("invalid_dsn", { status: 400, headers: corsHeaders });
    }
    if (!ALLOWED_HOSTS.has(parsed.host)) {
      return new Response("host_not_allowed", { status: 403, headers: corsHeaders });
    }

    const upstream = `https://${parsed.host}/api/${parsed.projectId}/envelope/`;
    const res = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
    });

    return new Response(res.body, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sentry-tunnel error:", msg);
    return new Response(JSON.stringify({ error: "tunnel_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
