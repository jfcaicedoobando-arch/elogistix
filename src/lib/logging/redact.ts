/**
 * FIX-42 — Redacción de PII y secretos en cualquier objeto que vaya a `console`
 * o a Sentry (`extra`, `contexts`, `request`, breadcrumbs).
 *
 * Diseño defensivo:
 *  - Nunca lanza: si algo no se puede recorrer, devuelve `"[unserializable]"`.
 *  - Idempotente: aplicar `redact(redact(x))` da el mismo resultado.
 *  - Trunca strings largos para evitar payloads infinitos en logs.
 */

const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /authorization/i,
  /api[_-]?key/i,
  /^token$/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /cookie/i,
  /rfc/i,
  /^email$/i,
  /correo/i,
  /curp/i,
  /telefono/i,
  /^phone$/i,
];

const MAX_STRING = 500;
const MAX_DEPTH = 6;
const REDACTED = "[REDACTED]";

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((rx) => rx.test(key));
}

function truncate(v: string): string {
  return v.length > MAX_STRING ? `${v.slice(0, MAX_STRING)}…[+${v.length - MAX_STRING}]` : v;
}

/** Enmascara emails preservando dominio: `hector@acme.com` → `h***@acme.com`. */
export function maskEmail(v: string): string {
  const m = v.match(/^([^@\s]+)@([^\s]+)$/);
  if (!m) return v;
  const [, user, domain] = m;
  const head = user.slice(0, 1);
  return `${head}${"*".repeat(Math.max(2, user.length - 1))}@${domain}`;
}

function redactString(v: string): string {
  // Emails embebidos → enmascarados.
  const withMaskedEmails = v.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, maskEmail);
  return truncate(withMaskedEmails);
}

export function redact<T = unknown>(value: T, depth = 0): T {
  // SAFE-CAST: helper genérico; los `as unknown as T` devuelven sentinelas o
  // reconstrucciones estructurales del mismo shape que la entrada.
  if (depth > MAX_DEPTH) return "[max-depth]" as unknown as T;
  if (value == null) return value;
  // SAFE-CAST: string redactado sigue siendo string.
  if (typeof value === "string") return redactString(value) as unknown as T;
  if (typeof value !== "object") return value;

  try {
    if (Array.isArray(value)) {
      // SAFE-CAST: map preserva forma de array.
      return value.map((v) => redact(v, depth + 1)) as unknown as T;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    // SAFE-CAST: reconstrucción estructural del objeto de entrada.
    return out as unknown as T;
  } catch {
    // SAFE-CAST: fallback sentinel string.
    return "[unserializable]" as unknown as T;
  }
}
