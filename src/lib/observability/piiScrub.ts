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
// 13.114.17: teléfonos MX en formatos comunes:
//   +52 55 1234 5678 / +521 5512345678 / (55) 1234-5678 / 5512345678
// Conservador: exige al menos 10 dígitos (excluye folios cortos) y delimitadores
// limitados (espacio, guion, paréntesis, punto). Evita matchear cadenas de IDs
// numéricos largos > 13 dígitos requiriendo un boundary final.
const PHONE_MX_RE = /(?:\+?52[\s-]?1?[\s-]?)?(?:\(?\d{2,3}\)?[\s.-]?)\d{3,4}[\s.-]?\d{4}(?!\d)/g;

/** Reemplaza RFC/CURP/email/teléfono por placeholders. Devuelve el mismo string si no aplica. */
export function scrubPii(input: string | undefined | null): string | undefined {
  if (!input) return input ?? undefined;
  return input
    .replace(RFC_RE, "[RFC]")
    .replace(CURP_RE, "[CURP]")
    .replace(EMAIL_RE, "[EMAIL]")
    .replace(PHONE_MX_RE, "[PHONE]");
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
    // En URLs relativas decodificamos los corchetes para mantener `[REDACTED]`
    // legible (logs/UI). En URLs absolutas conservamos la codificación URL.
    const out = isAbsolute
      ? u.toString()
      : `${u.pathname}${u.search}`.replace(/%5B/gi, "[").replace(/%5D/gi, "]");
    return scrubPii(out);
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
