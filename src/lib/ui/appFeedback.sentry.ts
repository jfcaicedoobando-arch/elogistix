/** Filtros de Sentry para notifyError. */

/** Decide si un error debe llegar a Sentry. */
export function shouldReportToSentry(error: unknown): boolean {
  if (error === undefined || error === null) return false;
  if (isExpectedValidation(error)) return false;
  if (isAuthorizationError(error)) return false;
  if (isAuthRateLimit(error)) return false;
  if (isWeakPasswordNotice(error)) return false;
  if (isExpectedFacturapiValidation(error)) return false;
  if (isTransientFacturapiNetwork(error)) return false;
  if (isExpectedBusinessRule(error)) return false;
  if (isTransientCfdiUploadNetwork(error)) return false;
  return true;
}

/**
 * Reglas de negocio esperadas que ya se muestran al usuario en el toast
 * (JAVASCRIPT-REACT-5Y, 5S): transición de estado inválida en cotizaciones
 * y conflicto de concurrencia optimista. Son avisos correctos, no bugs.
 */
export function isExpectedBusinessRule(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return /LC_COT_TRANSICION_INVALIDA|LC_CONFLICTO_CONCURRENCIA/.test(msg);
}

/**
 * Fallo de red del dispositivo al subir CFDI (JAVASCRIPT-REACT-5V, 1D):
 * fases `preflight`/`request` = CORS, DNS o conexión caída del cliente; ya
 * se guía al usuario ("revisa tu conexión", captura manual). Sólo la fase
 * `response` (el gateway respondió con error) sigue siendo reportable.
 */
export function isTransientCfdiUploadNetwork(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if ((err as { name?: unknown }).name !== "CfdiUploadError") return false;
  const phase = (err as { context?: { phase?: unknown } }).context?.phase;
  return phase === "preflight" || phase === "request";
}

/**
 * Aviso de contraseña débil de Supabase Auth (`weak_password`). Es una
 * validación correcta mostrada al usuario en el alta/cambio de contraseña,
 * no una falla de la app (Sentry JAVASCRIPT-REACT-5J).
 */
export function isWeakPasswordNotice(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (/password is known to be weak|weak_password|password should be at least/i.test(msg)) {
    return true;
  }
  if (typeof err !== "object" || err === null) return false;
  return (err as { code?: unknown }).code === "weak_password";
}


/**
 * Límite de reenvío de Supabase Auth ("For security purposes, you can only
 * request this after N seconds", `over_email_send_rate_limit`). Es un aviso
 * esperado al usuario, no una falla de la app: no debe llegar a Sentry.
 */
export function isAuthRateLimit(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; message?: unknown; status?: unknown };
  if (e.code === "over_email_send_rate_limit") return true;
  if (e.status === 429) return true;
  const msg = typeof e.message === "string" ? e.message : "";
  return /for security purposes, you can only request this after|email rate limit exceeded/i
    .test(msg);
}


/**
 * Validaciones de negocio esperadas (marcadas con `expected = true` en el
 * error). Son avisos correctos al usuario, no fallas: se muestran en el toast
 * pero NO se reportan a Sentry para no esconder bugs reales.
 */
export function isExpectedValidation(err: unknown): boolean {
  return (
    typeof err === "object"
    && err !== null
    && (err as { expected?: unknown }).expected === true
  );
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
