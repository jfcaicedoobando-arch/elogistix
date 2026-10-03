/** Public Sentry transport: validate the destination and forward exact bytes. */
import { excedeContentLength, leerEnvelopeAcotado, readEnvelopeDestination } from "./envelope.ts";
export { excedeContentLength, MAX_ENVELOPE_BYTES, parseEnvelopeDsn } from "./envelope.ts";

const ALLOWED_HOSTS = new Set(["o4511415732404224.ingest.us.sentry.io"]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sentry-auth",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Retry-After, X-Sentry-Rate-Limits",
};
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const rateBuckets = new Map<string, number[]>();

function getClientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function checkRateLimit(ip: string, now = Date.now()): boolean {
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const bucket = (rateBuckets.get(ip) ?? []).filter((time) => time > cutoff);
  if (bucket.length >= RATE_LIMIT_MAX) return false;
  bucket.push(now);
  rateBuckets.set(ip, bucket);
  if (rateBuckets.size > 5000) {
    for (const [key, values] of rateBuckets) {
      if (values.length === 0 || values[values.length - 1] < cutoff) rateBuckets.delete(key);
    }
  }
  return true;
}

export async function handleEnvelopeRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405, headers: corsHeaders });
  if (excedeContentLength(req)) return new Response("payload_too_large", { status: 413, headers: corsHeaders });
  if (!checkRateLimit(getClientIp(req))) {
    return new Response("rate_limited", { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } });
  }
  try {
    const bytes = await leerEnvelopeAcotado(req);
    if (bytes === null) return new Response("payload_too_large", { status: 413, headers: corsHeaders });
    const destination = readEnvelopeDestination(bytes);
    if (!destination) return new Response("invalid_envelope", { status: 400, headers: corsHeaders });
    if (!ALLOWED_HOSTS.has(destination.host)) {
      return new Response("host_not_allowed", { status: 403, headers: corsHeaders });
    }
    const res = await fetch(`https://${destination.host}/api/${destination.projectId}/envelope/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: bytes.buffer as ArrayBuffer,
      signal: AbortSignal.timeout(5000),
    });
    const headers = new Headers({ ...corsHeaders, "Content-Type": res.headers.get("Content-Type") ?? "application/json" });
    for (const name of ["Retry-After", "X-Sentry-Rate-Limits"]) {
      const value = res.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(res.body, { status: res.status, headers });
  } catch {
    // Never log the envelope or an upstream URL containing the DSN key.
    return new Response(JSON.stringify({ error: "tunnel_failed" }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

const deno = (globalThis as unknown as {
  Deno?: { serve: (handler: typeof handleEnvelopeRequest) => unknown };
}).Deno;
deno?.serve(handleEnvelopeRequest);
