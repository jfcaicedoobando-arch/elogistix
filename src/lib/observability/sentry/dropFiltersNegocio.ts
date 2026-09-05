/**
 * Filtros de ruido adicionales para `beforeSend` de Sentry: validaciones de
 * negocio de la base de datos, pérdida de conectividad y rechazos de promesa
 * sin información. Separado de `dropPredicate.ts` para respetar el límite de
 * 200 líneas por archivo.
 */
import type * as Sentry from "@sentry/react";

/**
 * Reglas de negocio de la base de datos (`RAISE EXCEPTION` → `P0001`) y
 * violaciones de unicidad/CHECK (`23505`/`23514`): son validaciones esperadas
 * que ya se muestran al usuario en un toast (embarque cerrado, contenedor
 * duplicado, CFDI duplicado). No son bugs. Ver JAVASCRIPT-REACT-4F/4G/4H/43.
 */
const CODIGOS_REGLA_NEGOCIO = new Set(["P0001", "23505", "23514"]);

function extraerPgCode(event: Sentry.ErrorEvent, exc: unknown): string | undefined {
  const directo = (exc as { code?: unknown } | undefined)?.code;
  if (typeof directo === "string") return directo;
  const tag = event.tags?.pg_code;
  if (typeof tag === "string") return tag;
  const extra = event.extra as { original?: { code?: unknown } } | undefined;
  const original = extra?.original?.code;
  return typeof original === "string" ? original : undefined;
}

export function isBusinessRuleViolation(event: Sentry.ErrorEvent, exc: unknown): boolean {
  const code = extraerPgCode(event, exc);
  return code !== undefined && CODIGOS_REGLA_NEGOCIO.has(code);
}

/**
 * Pérdida de conectividad del cliente (offline, red inestable, fetch abortado).
 * La app ya muestra un mensaje accionable; no hay nada que arreglar en código.
 * Ver JAVASCRIPT-REACT-4E/48/49.
 */
const PATRONES_RED = [
  "no se pudo conectar con el servidor",
  "failed to fetch",
  "networkerror when attempting to fetch",
  "load failed",
  "network request failed",
  "the network connection was lost",
];

export function isNetworkConnectivityNoise(event: Sentry.ErrorEvent, exc: unknown): boolean {
  const msg =
    (exc as { message?: unknown } | undefined)?.message ??
    event.exception?.values?.[0]?.value ??
    event.message;
  if (typeof msg !== "string") return false;
  const lower = msg.toLowerCase();
  return PATRONES_RED.some((p) => lower.includes(p));
}

/**
 * Rechazos de promesa serializados sin mensaje ni stacktrace
 * (`Object captured as promise rejection with keys: message` + `message: ""`).
 * No aportan información accionable. Ver JAVASCRIPT-REACT-4J.
 */
export function isEmptySerializedRejection(event: Sentry.ErrorEvent): boolean {
  const value = event.exception?.values?.[0];
  if (!value || value.stacktrace?.frames?.length) return false;
  if (!(value.value ?? "").includes("captured as promise rejection")) return false;
  const extra = event.extra as { __serialized__?: Record<string, unknown> } | undefined;
  const serialized = extra?.__serialized__;
  if (!serialized) return false;
  return Object.values(serialized).every((v) => v === "" || v == null);
}

/** Extrae el mensaje más representativo del evento/excepción. */
function mensajeDe(event: Sentry.ErrorEvent, exc: unknown): string {
  const msg =
    (exc as { message?: unknown } | undefined)?.message ??
    event.exception?.values?.[0]?.value ??
    event.message;
  return typeof msg === "string" ? msg.toLowerCase() : "";
}

/**
 * Validaciones de negocio que la UI ya explica en un toast pero que el código
 * re-envuelve en `new Error(mensaje)` perdiendo el `pg_code`, así que el filtro
 * por código no las alcanza. Ver JAVASCRIPT-REACT-4F/4N.
 */
const PATRONES_VALIDACION_NEGOCIO = [
  "ya está registrado en este embarque",
  "verifica el uuid en el sat",
  "factura duplicada",
  "no puedes aprobar o rechazar esta factura",
  "el embarque asociado no existe",
];

/** Clases de error de dominio: validaciones controladas, no bugs. */
const NOMBRES_ERROR_NEGOCIO = new Set([
  "AprobacionFacturaError",
  "CreditLimitError",
  "ValidationError",
  // JAVASCRIPT-REACT-55: archivo ya capturado en el buzón; la UI lo explica.
  "BuzonDuplicadoError",
  "ReglaNegocioError",
]);


export function isValidacionNegocioPorMensaje(
  event: Sentry.ErrorEvent,
  exc: unknown,
): boolean {
  const nombre = (exc as { name?: unknown } | undefined)?.name;
  if (typeof nombre === "string" && NOMBRES_ERROR_NEGOCIO.has(nombre)) return true;
  const tipo = event.exception?.values?.[0]?.type;
  if (typeof tipo === "string" && NOMBRES_ERROR_NEGOCIO.has(tipo)) return true;
  const msg = mensajeDe(event, exc);
  // Sentry -60: mensajes con código de dominio LC_* son validaciones de negocio.
  if (msg.startsWith("lc_")) return true;
  return PATRONES_VALIDACION_NEGOCIO.some((p) => msg.includes(p));
}

/**
 * Timeouts / 5xx del gateway (504 "upstream request timeout", 502, 503):
 * infraestructura, no bugs de la app. La UI ya ofrece "Reintentar".
 * Ver JAVASCRIPT-REACT-3B/39/4Q.
 */
const PATRONES_GATEWAY = [
  "upstream request timeout",
  "status code: 502",
  "status code: 503",
  "status code: 504",
  "gateway timeout",
];

export function isGatewayTimeoutNoise(event: Sentry.ErrorEvent, exc: unknown): boolean {
  const status = (exc as { status?: unknown } | undefined)?.status;
  if (status === 502 || status === 503 || status === 504) return true;
  const msg = mensajeDe(event, exc);
  return PATRONES_GATEWAY.some((p) => msg.includes(p));
}
