/**
 * Serializa cualquier objeto como `extra.payload` para Sentry de forma SEGURA:
 *
 * - Redacta claves sensibles (api_key, password, token, rfc, email, ...).
 * - Maneja referencias circulares, BigInt y Date.
 * - Recorta el resultado final a 8 KB para no inflar la cuota.
 *
 * 13.141.8 — auditoría Sentry: contexto enriquecido.
 */
const SENSITIVE_KEYS = new Set([
  "api_key",
  "apikey",
  "password",
  "pass",
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "authorization",
  "auth",
  "rfc",
  "curp",
  "email",
  "telefono",
  "phone",
  "ssn",
]);

const MAX_BYTES = 8 * 1024;

function shouldRedact(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

export function sanitizePayload(input: unknown): unknown {
  const seen = new WeakSet<object>();

  const walk = (value: unknown): unknown => {
    if (value === null || value === undefined) return value;
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value !== "object") return value;

    if (seen.has(value as object)) return "[Circular]";
    seen.add(value as object);

    if (Array.isArray(value)) return value.map(walk);

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = shouldRedact(k) ? "[REDACTED]" : walk(v);
    }
    return out;
  };

  const sanitized = walk(input);
  try {
    const json = JSON.stringify(sanitized);
    if (json && json.length > MAX_BYTES) {
      return { __truncated: true, preview: json.slice(0, MAX_BYTES) };
    }
    return sanitized;
  } catch {
    return { __unserializable: true };
  }
}
