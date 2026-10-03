/**
 * Serializa cualquier objeto como `extra.payload` para Sentry de forma SEGURA:
 *
 * - Redacta claves sensibles (api_key, password, token, rfc, email, ...).
 * - Maneja referencias circulares, BigInt y Date.
 * - Recorta el resultado final a 8 KB para no inflar la cuota.
 *
 * 13.141.8 — auditoría Sentry: contexto enriquecido.
 */
import { scrubTelemetryData } from "./scrubTelemetryData";

const MAX_BYTES = 8 * 1024;

export function sanitizePayload(input: unknown): unknown {
  const sanitized = scrubTelemetryData(input);
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
