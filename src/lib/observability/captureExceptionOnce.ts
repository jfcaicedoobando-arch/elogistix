import type { CaptureContext } from "@sentry/react";
import { loadInitializedSentry } from "./sentry/runtime";
import { isExpectedTelemetryError, isOfflineTelemetryError } from "./expectedTelemetryError";

const captures = new WeakMap<object, Promise<string | undefined>>();

function identityOf(error: unknown): object | null {
  if (!error || typeof error !== "object") return null;
  const cause = (error as { cause?: unknown }).cause;
  // React Query wraps PostgREST plain objects; retain the original identity.
  if (cause && typeof cause === "object" && !(cause instanceof Error)) return cause;
  return error;
}

export function toTelemetryError(error: unknown): Error {
  if (error instanceof Error) return error;
  const raw = error as { message?: unknown; code?: unknown; expected?: unknown } | undefined;
  const message = typeof error === "string" ? error
    : typeof raw?.message === "string" && raw.message ? raw.message : "unknown error";
  const normalized = new Error(message, { cause: error });
  if (typeof raw?.code === "string") Object.assign(normalized, { code: raw.code });
  if (typeof raw?.expected === "boolean") Object.assign(normalized, { expected: raw.expected });
  return normalized;
}

/** One capture promise per actual failure, shared by QueryCache/UI/boundaries. */
export function captureExceptionOnce(error: unknown, context: CaptureContext): Promise<string | undefined> {
  if (isExpectedTelemetryError(error) || isOfflineTelemetryError(error)) return Promise.resolve(undefined);
  const identity = identityOf(error);
  const existing = identity && captures.get(identity);
  if (existing) return existing;
  const pending = loadInitializedSentry().then((Sentry) => {
    if (!Sentry) {
      if (identity) captures.delete(identity);
      return undefined;
    }
    return Sentry.captureException(toTelemetryError(error), context);
  }).catch(() => {
    if (identity) captures.delete(identity);
    return undefined;
  });
  if (identity) captures.set(identity, pending);
  return pending;
}
