/** Intent-based filters; persistent infrastructure failures remain observable. */
import type * as Sentry from "@sentry/react";
import { isExpectedTelemetryError, isOfflineTelemetryError } from "../expectedTelemetryError";

function exceptionData(event: Sentry.ErrorEvent, exc: unknown): unknown {
  if (exc && typeof exc === "object") return exc;
  return {
    name: event.exception?.values?.[0]?.type,
    message: event.exception?.values?.[0]?.value ?? event.message,
    code: event.tags?.pg_code,
  };
}

export function isBusinessRuleViolation(event: Sentry.ErrorEvent, exc: unknown): boolean {
  return isExpectedTelemetryError(exceptionData(event, exc));
}

export function isNetworkConnectivityNoise(event: Sentry.ErrorEvent, exc: unknown): boolean {
  return isOfflineTelemetryError(exceptionData(event, exc));
}

export function isEmptySerializedRejection(event: Sentry.ErrorEvent): boolean {
  const value = event.exception?.values?.[0];
  if (!value || value.stacktrace?.frames?.length) return false;
  if (!(value.value ?? "").includes("captured as promise rejection")) return false;
  const extra = event.extra as { __serialized__?: Record<string, unknown> } | undefined;
  return Boolean(extra?.__serialized__) &&
    Object.values(extra!.__serialized__!).every((item) => item === "" || item == null);
}

export function isValidacionNegocioPorMensaje(event: Sentry.ErrorEvent, exc: unknown): boolean {
  return isExpectedTelemetryError(exceptionData(event, exc));
}

export function isGatewayTimeoutNoise(_event: Sentry.ErrorEvent, exc: unknown): boolean {
  // A timeout after retries is a failure, not proof of an expected validation.
  return (exc as { expected?: unknown } | undefined)?.expected === true;
}
