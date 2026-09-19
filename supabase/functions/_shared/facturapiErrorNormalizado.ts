/**
 * P2 · FacturAPI 5.0 — Normalización de errores del proveedor de timbrado,
 * con foco en RATE LIMITING (HTTP 429).
 *
 * Reglas invariantes (integridad fiscal):
 * - Un 429 NUNCA dispara un reintento automático de timbrado: reintentar a
 *   ciegas es el camino directo a un CFDI/REP duplicado. Se devuelve un error
 *   accionable que dice cuánto esperar y el operador decide.
 * - Se conservan SIEMPRE los metadatos de diagnóstico que entrega FacturAPI:
 *   `Retry-After`, `logId` (campo plano de `FacturapiError`) y el request id
 *   del encabezado (`x-request-id` / `request-id`), además del status HTTP.
 * - Este módulo es puro (sin red, sin SDK): se puede probar aislado.
 */

/** Códigos estables consumidos por el frontend. */
export const COD_FACTURAPI_RATE_LIMIT = "facturapi_rate_limit";
export const COD_FACTURAPI_TIMEOUT = "facturapi_timeout";

export interface FacturapiErrorNormalizado {
  /** Status HTTP de FacturAPI (502 si no se pudo determinar). */
  status: number;
  /** Código estable: el de FacturAPI o uno de los `COD_*` de este módulo. */
  code?: string;
  message: string;
  /** Mensaje en español listo para mostrar al operador. */
  mensajeUsuario: string;
  logId?: string;
  requestId?: string;
  /** Segundos a esperar según `Retry-After` (si el proveedor lo envió). */
  retryAfterSegundos?: number;
  rateLimited: boolean;
  timeout: boolean;
  /** `true` si el operador puede volver a intentar manualmente. */
  reintentable: boolean;
  /** Invariante: jamás se reintenta un timbrado de forma automática. */
  reintentoAutomatico: false;
}

type HeaderBag =
  | { get: (name: string) => string | null }
  | Record<string, unknown>
  | null
  | undefined;

interface ErrorLike {
  response?: { status?: number; data?: unknown; headers?: HeaderBag };
  status?: number;
  data?: unknown;
  headers?: HeaderBag;
  message?: string;
  code?: string;
  logId?: string;
  name?: string;
  retryAfter?: unknown;
  retry_after?: unknown;
}

function leerHeader(bag: HeaderBag, nombre: string): string | null {
  if (!bag) return null;
  const conGet = bag as { get?: (n: string) => string | null };
  if (typeof conGet.get === "function") return conGet.get(nombre) ?? null;
  const plano = bag as Record<string, unknown>;
  for (const clave of Object.keys(plano)) {
    if (clave.toLowerCase() !== nombre) continue;
    const v = plano[clave];
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

function headersDeError(e: ErrorLike): HeaderBag[] {
  return [e.response?.headers, e.headers];
}

/** Segundos de espera: acepta segundos numéricos o fecha HTTP. */
export function parseRetryAfter(valor: unknown): number | undefined {
  if (typeof valor === "number" && Number.isFinite(valor) && valor >= 0) {
    return Math.ceil(valor);
  }
  if (typeof valor !== "string" || valor.trim() === "") return undefined;
  const texto = valor.trim();
  if (/^\d+$/.test(texto)) return Number(texto);
  const fecha = Date.parse(texto);
  if (Number.isNaN(fecha)) return undefined;
  return Math.max(0, Math.ceil((fecha - Date.now()) / 1000));
}

function retryAfterDeError(e: ErrorLike, base: Record<string, unknown>): number | undefined {
  for (const bag of headersDeError(e)) {
    const crudo = leerHeader(bag, "retry-after");
    const seg = parseRetryAfter(crudo);
    if (seg !== undefined) return seg;
  }
  return parseRetryAfter(e.retryAfter ?? e.retry_after ?? base.retry_after);
}

function requestIdDeError(e: ErrorLike, base: Record<string, unknown>): string | undefined {
  for (const bag of headersDeError(e)) {
    const id = leerHeader(bag, "x-request-id") ?? leerHeader(bag, "request-id");
    if (id) return id;
  }
  const plano = base.request_id ?? base.requestId;
  return typeof plano === "string" && plano.length > 0 ? plano : undefined;
}

/** Texto accionable para el operador cuando hay tope de peticiones. */
export function mensajeEsperaRateLimit(segundos?: number): string {
  const espera = segundos && segundos > 0
    ? `Espera ${segundos} segundo${segundos === 1 ? "" : "s"} antes de reintentar`
    : "Espera un minuto antes de reintentar";
  return `El proveedor de timbrado limitó temporalmente las peticiones (429). ${espera}. ` +
    "No se timbró nada y no se reintentará por sí solo, así evitamos comprobantes duplicados.";
}

function esTimeout(e: ErrorLike): boolean {
  return e.name === "FacturapiTimeoutError" || e.name === "TimeoutError" ||
    e.name === "AbortError" || e.status === 504;
}

function mensajeBase(e: ErrorLike, base: Record<string, unknown>, err: unknown): string {
  const deBase = base.message;
  if (typeof deBase === "string" && deBase.length > 0) return deBase;
  if (typeof e.message === "string" && e.message.length > 0) return e.message;
  return String(err);
}

const MSG_TIMEOUT = "El proveedor de timbrado no respondió a tiempo. No se timbró nada; " +
  "vuelve a intentarlo o usa «Recuperar timbrado».";

interface Clasificacion { rateLimited: boolean; timeout: boolean; retryAfterSegundos?: number }

function codigoNormalizado(
  base: Record<string, unknown>, e: ErrorLike, c: Clasificacion,
): string | undefined {
  if (c.rateLimited) return COD_FACTURAPI_RATE_LIMIT;
  const codeProveedor = typeof base.code === "string" ? base.code : e.code;
  if (codeProveedor) return codeProveedor;
  return c.timeout ? COD_FACTURAPI_TIMEOUT : undefined;
}

function mensajeNormalizado(message: string, c: Clasificacion): string {
  if (c.rateLimited) return mensajeEsperaRateLimit(c.retryAfterSegundos);
  return c.timeout ? MSG_TIMEOUT : message;
}

/**
 * Normaliza cualquier error del SDK / HTTP de FacturAPI a un shape estable.
 * No decide reintentos: sólo informa si el operador puede reintentar.
 */
export function normalizarErrorFacturapi(err: unknown): FacturapiErrorNormalizado {
  const e = (err ?? {}) as ErrorLike;
  const timeout = esTimeout(e);
  const status = e.response?.status ?? e.status ?? (timeout ? 504 : 502);
  const base = (e.response?.data ?? e.data ?? {}) as Record<string, unknown>;
  const clasificacion: Clasificacion = {
    rateLimited: status === 429,
    timeout,
    retryAfterSegundos: retryAfterDeError(e, base),
  };
  const message = mensajeBase(e, base, err);

  return {
    status,
    code: codigoNormalizado(base, e, clasificacion),
    message,
    mensajeUsuario: mensajeNormalizado(message, clasificacion),
    logId: typeof base.logId === "string" ? base.logId : e.logId,
    requestId: requestIdDeError(e, base),
    retryAfterSegundos: clasificacion.retryAfterSegundos,
    rateLimited: clasificacion.rateLimited,
    timeout,
    reintentable: clasificacion.rateLimited || timeout || status >= 500,
    reintentoAutomatico: false,
  };
}


/** Metadatos seguros para bitácora/Sentry (sin payloads ni secretos). */
export function metadatosErrorFacturapi(
  norm: FacturapiErrorNormalizado,
): Record<string, unknown> {
  return {
    status: norm.status,
    code: norm.code ?? null,
    log_id: norm.logId ?? null,
    request_id: norm.requestId ?? null,
    retry_after_segundos: norm.retryAfterSegundos ?? null,
    rate_limited: norm.rateLimited,
    timeout: norm.timeout,
  };
}
