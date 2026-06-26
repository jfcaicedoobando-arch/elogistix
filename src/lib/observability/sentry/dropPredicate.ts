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
