/**
 * Helpers de scrub de PII para Sentry (P3).
 * Aplica regex de RFC (mexicano), CURP y email sobre strings arbitrarios
 * y limpia query strings sensibles de URLs. Sin dependencias de Sentry para
 * facilitar testing aislado.
 */

// RFC mexicano persona física (4 letras) o moral (3 letras) + 6 dígitos + 3 alfanum.
const RFC_RE = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/g;
// CURP: 18 caracteres con patrón fijo.
const CURP_RE = /\b[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d\b/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

/** Reemplaza RFC/CURP/email por placeholders. Devuelve el mismo string si no aplica. */
export function scrubPii(input: string | undefined | null): string | undefined {
  if (!input) return input ?? undefined;
  return input
    .replace(RFC_RE, "[RFC]")
    .replace(CURP_RE, "[CURP]")
    .replace(EMAIL_RE, "[EMAIL]");
}

/** Limpia query string: quita pares cuyo nombre coincide con la lista de sensibles. */
const SENSITIVE_QS = new Set(["email", "rfc", "token", "access_token", "refresh_token", "curp"]);

export function scrubUrl(url: string | undefined | null): string | undefined {
  if (!url) return url ?? undefined;
  try {
    const u = new URL(url, "http://x");
    let changed = false;
    for (const key of Array.from(u.searchParams.keys())) {
      if (SENSITIVE_QS.has(key.toLowerCase())) {
        u.searchParams.set(key, "[REDACTED]");
        changed = true;
      }
    }
    if (!changed) return scrubPii(url);
    // Conservar el path original (sin host artificial cuando la URL era relativa).
    const isAbsolute = /^https?:\/\//i.test(url);
    const out = isAbsolute ? u.toString() : `${u.pathname}${u.search}`;
    // URL encodea `[` y `]` como %5B/%5D; restauramos los placeholders legibles.
    return scrubPii(out.replace(/%5B/gi, "[").replace(/%5D/gi, "]"));
  } catch {
    return scrubPii(url);
  }
}

/** URLs de la API de datos con payload sensible (RFC, montos, nombres). */
const SENSITIVE_API_RE = /\/rest\/v1\/(clientes|facturas|proformas|proveedores|conceptos_venta|conceptos_costo|pagos_factura|pagos_proveedor)/i;

export function isSensitiveApiUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return SENSITIVE_API_RE.test(url);
}
