/**
 * Predicado para `beforeSend` de Sentry: decide si un evento debe descartarse.
 * Extraído de `core.ts` para mantener el archivo bajo el límite de 200 líneas.
 */
import type * as Sentry from "@sentry/react";
import { isReactRefreshHmrError, isReactRefreshStackTrace } from "./helpers";
import { isExpectedTelemetryError } from "../expectedTelemetryError";
import {
  isBusinessRuleViolation,
  isNetworkConnectivityNoise,
  isEmptySerializedRejection,
  isValidacionNegocioPorMensaje,
  isGatewayTimeoutNoise,
} from "./dropFiltersNegocio";


/** Development HMR is noise; exhausted chunk recovery is not. */
function isRecoverableLoadError(
  event: Sentry.ErrorEvent,
  exc: Error | undefined,
): boolean {
  const values = event.exception?.values;
  if (exc && isReactRefreshHmrError(exc)) return true;
  if (values?.some((v) => isReactRefreshStackTrace(v.stacktrace))) return true;
  return false;
}

/** Errores de validación (zod) son input del usuario, no bugs. */
function isZodValidationError(exc: Error | undefined): boolean {
  const cause = (exc as (Error & { cause?: unknown }) | undefined)?.cause;
  const causeName = (cause as { name?: string } | undefined)?.name;
  const excName = (exc as { name?: string } | undefined)?.name;
  return causeName === "ZodError" || excName === "ZodError";
}

/**
 * Errores de RLS de Postgres (`42501`) son denegaciones de permiso legítimas,
 * no bugs. Se pueden originar desde `originalException` (PostgrestError) o
 * desde el payload serializado en `event.extra.__serialized__`.
 */
function isPostgresRlsDenied(
  event: Sentry.ErrorEvent,
  exc: unknown,
): boolean {
  const code = (exc as { code?: unknown } | undefined)?.code;
  if (typeof code === "string" && code === "42501") return isExpectedTelemetryError(exc);
  const extra = event.extra as { __serialized__?: { code?: unknown } } | undefined;
  const serializedCode = extra?.__serialized__?.code;
  return serializedCode === "42501" && isExpectedTelemetryError(extra?.__serialized__);
}

/**
 * Errores del pixel de analítica del hosting (`flock.js` en librecarga.com):
 * son 5xx del endpoint `/~api/analytics` que Lovable inyecta al servir la app.
 * No es código nuestro y no rompe la UI. Ver Sentry JAVASCRIPT-REACT-22.
 */
function isHostingAnalyticsNoise(
  event: Sentry.ErrorEvent,
  exc: unknown,
): boolean {
  const url = (exc as { request?: { url?: string } } | undefined)?.request?.url
    ?? (event.request?.url as string | undefined);
  if (typeof url === "string" && url.includes("/~api/analytics")) return true;
  const values = event.exception?.values ?? [];
  return values.some((v) =>
    v.stacktrace?.frames?.some((f) => (f.filename ?? "").includes("flock.js")),
  );
}

/**
 * Circular JSON is only extension noise when frames prove an extension origin.
 */
function isBrowserExtensionCircularJson(
  event: Sentry.ErrorEvent,
  exc: unknown,
): boolean {
  const msg =
    (exc as { message?: unknown } | undefined)?.message ??
    event.exception?.values?.[0]?.value ??
    event.message;
  if (typeof msg !== "string" || !msg.includes("Converting circular structure to JSON")) {
    return false;
  }
  const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
  return frames.some((f) => /^(?:chrome|moz|safari.*)-extension:\/\//i.test(f.filename ?? ""));
}


/**
 * Ephemeral developer tunnels are noise, not production Cloudflare failures.
 */

function isEphemeralTunnelUrl(event: Sentry.ErrorEvent): boolean {
  const url = event.request?.url ?? (typeof window !== "undefined" ? window.location?.href : "");
  return typeof url === "string" && url.includes(".trycloudflare.com");
}

function isCloudflareTunnelNoise(event: Sentry.ErrorEvent): boolean {
  return isEphemeralTunnelUrl(event);
}

/**
 * `notifyError` re-envuelve el PostgrestError en un `new Error(mensaje)`, así
 * que el código 42501 sólo sobrevive en tags/extra. Sin esto los rechazos de
 * RLS (permiso denegado, no bug) seguían llegando. Ver JAVASCRIPT-REACT-3S.
 */
function isRlsDeniedFromTags(event: Sentry.ErrorEvent): boolean {
  const extra = event.extra as { original?: { code?: unknown } } | undefined;
  if (extra?.original?.code === "42501") return isExpectedTelemetryError(extra.original);
  return event.tags?.pg_code === "42501" && isExpectedTelemetryError({
    code: "42501", message: event.exception?.values?.[0]?.value ?? event.message,
  });
}

/** Filtros de ruido que reciben `(event, originalException)`. */
const NOISE_FILTERS: ReadonlyArray<(event: Sentry.ErrorEvent, exc: unknown) => boolean> = [
  isPostgresRlsDenied,
  isHostingAnalyticsNoise,
  isBrowserExtensionCircularJson,
  isCloudflareTunnelNoise,
  isBusinessRuleViolation,
  isNetworkConnectivityNoise,
  isValidacionNegocioPorMensaje,
  isGatewayTimeoutNoise,
  (event) => isEmptySerializedRejection(event),
];



export function shouldDropSentryEvent(
  event: Sentry.ErrorEvent,
  hint: Sentry.EventHint | undefined,
): boolean {
  const exc = hint?.originalException as Error | undefined;
  const intent = exc as { expected?: unknown; cause?: { expected?: unknown } } | undefined;
  if (intent?.expected === false || intent?.cause?.expected === false) return false;
  if (isExpectedTelemetryError(exc)) return true;
  if (isRecoverableLoadError(event, exc)) return true;
  if (isZodValidationError(exc)) return true;
  if (isRlsDeniedFromTags(event)) return true;
  return NOISE_FILTERS.some((fn) => fn(event, hint?.originalException));
}



/** Resuelve el environment de Sentry. Prioriza `VITE_SENTRY_ENV` (permite
 *  distinguir `preview` de `production` en builds idénticos). Fallback a MODE. */
export function resolveSentryEnvironment(): string {
  const explicit = import.meta.env.VITE_SENTRY_ENV as string | undefined;
  if (explicit && explicit.length > 0) return explicit;
  if (typeof window !== "undefined") {
    const host = window.location?.hostname ?? "";
    if (host.endsWith("lovable.app")) return "preview";
    if (host === "librecarga.com" || host === "www.librecarga.com") return "production";
  }
  return import.meta.env.MODE;
}
