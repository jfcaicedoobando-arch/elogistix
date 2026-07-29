/**
 * Predicado para `beforeSend` de Sentry: decide si un evento debe descartarse.
 * Extraído de `core.ts` para mantener el archivo bajo el límite de 200 líneas.
 */
import type * as Sentry from "@sentry/react";
import { isDynamicImportErrorMessage } from "@/lib/errors/dynamicImportError";
import { isReactRefreshHmrError, isReactRefreshStackTrace } from "./helpers";

/** Detecta errores de chunk/HMR que se auto-recuperan con reload. */
function isRecoverableLoadError(
  event: Sentry.ErrorEvent,
  exc: Error | undefined,
  originalMsg: string | undefined,
): boolean {
  if (isDynamicImportErrorMessage(originalMsg)) return true;
  if (isDynamicImportErrorMessage(event.message)) return true;
  const values = event.exception?.values;
  if (values?.some((v) => isDynamicImportErrorMessage(v.value))) return true;
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
  if (typeof code === "string" && code === "42501") return true;
  const extra = event.extra as { __serialized__?: { code?: unknown } } | undefined;
  const serializedCode = extra?.__serialized__?.code;
  return typeof serializedCode === "string" && serializedCode === "42501";
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
 * `TypeError: Converting circular structure to JSON` originado desde
 * `<anonymous>` (extensiones del navegador que monkey-parchean `appendChild`
 * y stringifican el DOM). No es código nuestro y no rompe la UI.
 * Ver Sentry JAVASCRIPT-REACT-2F/2G.
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
  // Si al menos un frame vive en `<anonymous>` (extensión) lo tratamos como ruido.
  return frames.some((f) => (f.filename ?? "").includes("<anonymous>"));
}

/**
 * Ruido de infraestructura: el servidor devolvió una página HTML (error 1033
 * de Cloudflare Tunnel, 502/504 del proxy, portal cautivo) en vez de JSON.
 * El cliente serializa el doctype como excepción. No es un bug de la app.
 * Ver Sentry JAVASCRIPT-REACT-3N/3P/3R/3Z.
 */
function isHtmlGatewayNoise(event: Sentry.ErrorEvent, exc: unknown): boolean {
  const candidates: unknown[] = [
    (exc as { message?: unknown } | undefined)?.message,
    typeof exc === "string" ? exc : undefined,
    event.exception?.values?.[0]?.value,
    event.message,
  ];
  return candidates.some((c) => {
    if (typeof c !== "string") return false;
    const head = c.trim().slice(0, 400).toLowerCase();
    if (head.startsWith("<!doctype html") || head.startsWith("<html")) return true;
    return head.includes("error 1033") || head.includes("cloudflare tunnel error");
  });
}

export function shouldDropSentryEvent(
  event: Sentry.ErrorEvent,
  hint: Sentry.EventHint | undefined,
): boolean {
  const exc = hint?.originalException as Error | undefined;
  const originalMsg =
    exc?.message ??
    (typeof hint?.originalException === "string" ? hint.originalException : undefined);
  if (isRecoverableLoadError(event, exc, originalMsg)) return true;
  if (isZodValidationError(exc)) return true;
  if (isPostgresRlsDenied(event, hint?.originalException)) return true;
  if (isHostingAnalyticsNoise(event, hint?.originalException)) return true;
  if (isBrowserExtensionCircularJson(event, hint?.originalException)) return true;
  if (isHtmlGatewayNoise(event, hint?.originalException)) return true;
  return false;
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
