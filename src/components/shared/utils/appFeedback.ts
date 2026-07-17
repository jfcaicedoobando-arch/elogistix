/**
 * Helpers unificados para emitir toasts en TODA la aplicación con severidades
 * consistentes.
 *
 * v12.16.0 — Backend unificado a **Sonner**. Las firmas públicas conservan el
 * primer parámetro `toast` por compatibilidad con los ~70 call sites previos,
 * pero internamente se ignora y se emite siempre vía `sonner.toast.*`.
 *
 * Estándar:
 *   - error     → sonner.error (persistente si hay debug, con acción "Ver detalles")
 *   - warning   → sonner.warning
 *   - success   → sonner.success
 */
import { toast as sonnerToast } from "sonner";
import { STEP_LABELS } from "@/features/embarques/domain/embarqueWizardSchemas";
import { buildErrorReport } from "@/components/shared/utils/errorReport";
import { openErrorReport } from "@/lib/diagnostics/errorDetailsStore";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";

/**
 * Firma laxa retenida sólo por compatibilidad con call sites que aún pasan
 * el `toast` del antiguo shadcn `useToast`. El argumento se ignora — usamos
 * `never` en posición contravariante para aceptar cualquier toast (shadcn
 * `{title,...}`, sonner, etc.) bajo `strictFunctionTypes`. La función NUNCA
 * se invoca dentro de los helpers — todo va por `sonner` directo.
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

  // 13.114.20: cierre del gap principal de la auditoría — `notifyError` es el
  // toast unificado (340 call sites). Antes sólo armaba el payload de debug:
  // sin que el usuario abriera "Ver detalles" Sentry nunca veía el error.
  // Reportamos sólo cuando hay `error` real (skip puro form-validation que
  // pasa `errors`/`message` sin objeto Error, para no inflar la cuota).
  //
  // 13.300.7: además, filtramos errores de autorización (RLS/guards del
  // backend). No son bugs — mostramos el toast pero NO enviamos a Sentry.
  //
  // 13.301.59: también filtramos validaciones esperadas de FacturApi/SAT
  // (razón social vs RFC, RFC no registrado, régimen inválido). El usuario
  // debe corregir el catálogo — no es bug de código.
  if (
    error !== undefined
    && error !== null
    && !isAuthorizationError(error)
    && !isExpectedFacturapiValidation(error)
    && !isTransientFacturapiNetwork(error)
  ) {
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

/**
 * Detecta errores de autorización esperados (guards RLS / RPC del backend).
 * Estos NO deben reportarse a Sentry — son parte del flujo normal cuando un
 * usuario intenta una acción para la que no tiene permisos.
 */
export function isAuthorizationError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return /no tienes permisos|permission denied|not authorized|forbidden|acceso denegado/i.test(
    msg,
  );
}

/**
 * Detecta validaciones de negocio esperadas de FacturApi/SAT (dato mal
 * capturado en el catálogo del cliente). Se identifica vía el flag
 * `expected` que expone `FacturapiError` (whitelist regex vive en
 * `services/facturapi.ts`).
 */
export function isExpectedFacturapiValidation(err: unknown): boolean {
  return (
    typeof err === "object"
    && err !== null
    && (err as { name?: unknown }).name === "FacturapiError"
    && (err as { expected?: unknown }).expected === true
  );
}

/** Emite un toast de advertencia (no bloquea). */
export function notifyWarning(
  _toast: AnyToastFn | undefined,
  opts: { title: string; description?: string },
) {
  sonnerToast.warning(opts.title, { description: opts.description });
}

/** Emite un toast de éxito. */
export function notifySuccess(
  _toast: AnyToastFn | undefined,
  opts: { title: string; description?: string },
) {
  sonnerToast.success(opts.title, { description: opts.description });
}
