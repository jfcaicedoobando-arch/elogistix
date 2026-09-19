/**
 * P2-B · Respuesta estándar ante RATE LIMITING (HTTP 429) de FacturAPI.
 *
 * Invariante fiscal: NINGÚN timbrado se reintenta automáticamente. Ante un 429
 * se devuelve un error accionable (cuánto esperar, si es reintentable y el
 * request id para soporte) y el operador decide cuándo volver a intentar. Un
 * reintento automático arriesga CFDIs/REP duplicados.
 */
import { jsonResponse } from "./response.ts";

export const COD_RATE_LIMIT = "facturapi_rate_limit";

export interface DetalleRateLimit {
  rateLimited?: boolean;
  retryAfterSegundos?: number;
  mensajeUsuario?: string;
  requestId?: string;
  logId?: string;
}

/** `true` si el proveedor aplicó tope de peticiones. */
export function esRateLimitFacturapi(status: number, detail?: DetalleRateLimit | null): boolean {
  return status === 429 || detail?.rateLimited === true;
}

/** Cuerpo JSON accionable (sin payloads ni secretos). */
export function cuerpoRateLimit(detail: DetalleRateLimit | null | undefined): Record<string, unknown> {
  return {
    error: COD_RATE_LIMIT,
    message: detail?.mensajeUsuario ??
      "El proveedor de timbrado limitó temporalmente las peticiones. Espera un momento y reintenta.",
    retry_after_segundos: detail?.retryAfterSegundos ?? null,
    retryable: true,
    /** El ERP nunca reintenta por sí solo: evita comprobantes duplicados. */
    reintento_automatico: false,
    request_id: detail?.requestId ?? null,
    log_id: detail?.logId ?? null,
  };
}

/** 429 con `Retry-After` cuando el proveedor lo indicó. */
export function respuestaRateLimit(detail: DetalleRateLimit | null | undefined): Response {
  const res = jsonResponse(cuerpoRateLimit(detail), 429);
  const segundos = detail?.retryAfterSegundos;
  if (typeof segundos === "number" && segundos >= 0) {
    res.headers.set("Retry-After", String(segundos));
  }
  return res;
}
