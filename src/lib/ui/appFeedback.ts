/**
 * Helpers unificados para emitir toasts en TODA la aplicación con severidades
 * consistentes.
 *
 * v12.16.0 — Backend unificado a **Sonner**. Las firmas públicas conservan el
 * primer parámetro `toast` por compatibilidad con los ~70 call sites previos,
 * pero internamente se ignora y se emite siempre vía `sonner.toast.*`.
 *
 * v13.308.7 — Cobertura 100% de "Ver detalles":
 *   - `notifyError` (ya lo tenía)
 *   - `notifySuccess`, `notifyWarning`, `notifyInfo` (nuevo): aceptan
 *     `error?`, `context?`, `method?`, `payload?`, `requestId?`,
 *     `showDetails?`. Si viene cualquiera de esos campos, el toast lleva
 *     acción **"Ver detalles"** que abre `ErrorDetailsDialog` con reporte
 *     copiable. Sin esos campos, se mantiene el toast minimalista.
 *
 * Estándar:
 *   - error     → sonner.error (persistente + "Ver detalles", siempre)
 *   - warning   → sonner.warning ("Ver detalles" si hay debug)
 *   - success   → sonner.success ("Ver detalles" si hay debug)
 *   - info      → sonner ("Ver detalles" si hay debug)
 */
import { toast as sonnerToast } from "sonner";
import { STEP_LABELS } from "@/features/embarques/domain/embarqueWizardSchemas";
import { buildErrorReport } from "@/lib/ui/errorReport";
import { openErrorReport } from "@/lib/diagnostics/errorDetailsStore";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";

/**
 * Firma laxa retenida sólo por compatibilidad con call sites que aún pasan
 * el `toast` del antiguo shadcn `useToast`. El argumento se ignora — usamos
 * `never` en posición contravariante para aceptar cualquier toast (shadcn
 * `{title,...}`, sonner, etc.) bajo `strictFunctionTypes`.
 */
export type AnyToastFn = (props: never) => unknown;

export interface ErrorNotifyOptions {
  step?: number;
  phase?: string;
  errors?: Record<string, string>;
  message?: string;
  description?: string;
  title?: string;
  error?: unknown;
  context?: Record<string, unknown>;
  errorCode?: string;
  method?: string;
  /** Payload original de la operación; se sanitiza antes de Sentry. */
  payload?: unknown;
  /** Correlation ID si el backend lo devolvió. */
  requestId?: string;
}

/** Opciones comunes para success/warning/info (todas con debug opcional). */
export interface InfoNotifyOptions {
  title: string;
  description?: string;
  duration?: number;
  /** ID de dedupe (pasa a sonner). */
  id?: string | number;
  /** Si viene `error`/`context`/`method`/`payload`/`requestId` o `showDetails=true`,
   *  el toast incluye acción "Ver detalles". */
  error?: unknown;
  context?: Record<string, unknown>;
  method?: string;
  payload?: unknown;
  requestId?: string;
  errorCode?: string;
  /** Fuerza el botón "Ver detalles" aunque no haya error/contexto. */
  showDetails?: boolean;
}

function shouldAttachDetails(opts: InfoNotifyOptions): boolean {
  return Boolean(
    opts.showDetails
    || opts.error !== undefined
    || opts.context !== undefined
    || opts.method
    || opts.payload !== undefined
    || opts.requestId
    || opts.errorCode,
  );
}

function buildDetailsAction(opts: InfoNotifyOptions & { titleFinal: string; phase?: string }) {
  const debug = buildErrorReport({
    title: opts.titleFinal,
    description: opts.description,
    phase: opts.phase,
    error: opts.error,
    context: opts.context,
    errorCode: opts.errorCode,
    method: opts.method,
  });
  return {
    label: "Ver detalles",
    onClick: () => openErrorReport(debug),
  };
}

/** Emite un toast bloqueante (error) con payload de debug copiable. */
export function notifyError(_toast: AnyToastFn | undefined, opts: ErrorNotifyOptions) {
  const {
    step, phase, errors, message, description: descOpt, title, error, context,
    errorCode, method, payload, requestId,
  } = opts;
  const description = descOpt ?? message ?? (errors ? Object.values(errors)[0] : undefined);

  let computedTitle = title;
  if (!computedTitle) {
    if (typeof step === "number") {
      const label = STEP_LABELS[step] ?? `Paso ${step}`;
      computedTitle = `Revisa el Paso ${step}: ${label}`;
    } else if (phase) {
      computedTitle = `Error: ${phase}`;
    } else {
      computedTitle = "Error";
    }
  }

  const debug = buildErrorReport({
    title: computedTitle,
    description,
    phase,
    step,
    error,
    context,
    errorCode,
    method,
  });

  sonnerToast.error(computedTitle, {
    description,
    duration: Infinity,
    action: {
      label: "Ver detalles",
      onClick: () => openErrorReport(debug),
    },
  });

  // 13.114.20 / 13.300.7 / 13.301.59: reportamos a Sentry sólo cuando hay error
  // real y no es autorización / validación esperada / fallo transitorio de red.
  if (shouldReportToSentry(error)) {
    reportCaughtError(
      error,
      {
        feature: phase ?? "ui_notify",
        op: method ?? (typeof step === "number" ? `step_${step}` : "unknown"),
      },
      {
        ...(context ?? {}),
        step,
        errorCode,
        title: computedTitle,
        description,
        payload,
        requestId,
      },
    );
  }
}

/** Decide si un error debe llegar a Sentry. */
function shouldReportToSentry(error: unknown): boolean {
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

/** Emite un toast de advertencia (no bloquea). Puede llevar "Ver detalles". */
export function notifyWarning(
  _toast: AnyToastFn | undefined,
  opts: InfoNotifyOptions,
) {
  const action = shouldAttachDetails(opts)
    ? buildDetailsAction({ ...opts, titleFinal: opts.title })
    : undefined;
  sonnerToast.warning(opts.title, {
    description: opts.description,
    duration: opts.duration,
    id: opts.id,
    action,
  });
}

/** Emite un toast de éxito. Puede llevar "Ver detalles" si se pasa error/context/etc. */
export function notifySuccess(
  _toast: AnyToastFn | undefined,
  opts: InfoNotifyOptions,
) {
  const action = shouldAttachDetails(opts)
    ? buildDetailsAction({ ...opts, titleFinal: opts.title })
    : undefined;
  sonnerToast.success(opts.title, {
    description: opts.description,
    duration: opts.duration,
    id: opts.id,
    action,
  });
}

/** Emite un toast informativo (neutro). Puede llevar "Ver detalles". */
export function notifyInfo(
  _toast: AnyToastFn | undefined,
  opts: InfoNotifyOptions,
) {
  const action = shouldAttachDetails(opts)
    ? buildDetailsAction({ ...opts, titleFinal: opts.title })
    : undefined;
  sonnerToast(opts.title, {
    description: opts.description,
    duration: opts.duration,
    id: opts.id,
    action,
  });
}
