/** Filtros de Sentry para notifyError. */

/** Decide si un error debe llegar a Sentry. */
export function shouldReportToSentry(error: unknown): boolean {
  if (error === undefined || error === null) return false;
  if (isAuthorizationError(error)) return false;
  if (isExpectedFacturapiValidation(error)) return false;
  if (isTransientFacturapiNetwork(error)) return false;
  return true;
}

export function isAuthorizationError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return /no tienes permisos|permission denied|not authorized|forbidden|acceso denegado/i.test(
    msg,
  );
}

export function isExpectedFacturapiValidation(err: unknown): boolean {
  return (
    typeof err === "object"
    && err !== null
    && (err as { name?: unknown }).name === "FacturapiError"
    && (err as { expected?: unknown }).expected === true
  );
}

export function isTransientFacturapiNetwork(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if ((err as { name?: unknown }).name !== "FacturapiError") return false;
  if ((err as { transient?: unknown }).transient !== true) return false;
  const msg = (err as { message?: unknown }).message;
  if (typeof msg !== "string") return false;
  return /failed to send a request to the edge function|networkerror|failed to fetch|load failed/i
    .test(msg);
}
