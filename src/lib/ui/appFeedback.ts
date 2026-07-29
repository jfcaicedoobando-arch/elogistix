/**
 * Helpers unificados para emitir toasts en TODA la aplicación con severidades
 * consistentes.
 *
 * v12.16.0 — Backend unificado a **Sonner**. Las firmas públicas conservan el
 * primer parámetro `toast` por compatibilidad con los ~70 call sites previos,
 * pero internamente se emite siempre vía `sonner.toast.*`.
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
import { buildErrorReport } from "./errorReport";
import { openErrorReport } from "@/lib/diagnostics/errorDetailsStore";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { shouldAttachDetails, buildDetailsAction } from "./appFeedback.details";
import { shouldReportToSentry } from "./appFeedback.sentry";
import type { AnyToastFn, ErrorNotifyOptions, InfoNotifyOptions } from "./appFeedback.types";

export * from "./appFeedback.types";
export * from "./appFeedback.sentry";

/** Emite un toast bloqueante (error) con payload de debug copiable. */
export function notifyError(_toast: AnyToastFn | undefined, opts: ErrorNotifyOptions) {
  const {
    step, phase, errors, message, description: descOpt, title, error, context,
    errorCode, method, payload, requestId, action,
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
    // P-05: dedupe por código de error (reemplaza en vez de apilar) y
    // auto-dismiss a 8s: los toasts persistentes tapaban los botones del header.
    id: `err-${errorCode ?? phase ?? "generic"}`,
    duration: 8000,
    // Q-08: si hay acción primaria (Reintentar), "Ver detalles" baja a secundaria.
    action: action ?? { label: "Ver detalles", onClick: () => openErrorReport(debug) },
    cancel: action ? { label: "Ver detalles", onClick: () => openErrorReport(debug) } : undefined,
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

/** Emite un toast de advertencia (no bloquea). Puede llevar "Ver detalles". */
export function notifyWarning(
  _toast: AnyToastFn | undefined,
  opts: InfoNotifyOptions,
) {
  const action = opts.action
    ?? (shouldAttachDetails(opts)
      ? buildDetailsAction({ ...opts, titleFinal: opts.title })
      : undefined);
  sonnerToast.warning(opts.title, {
    description: opts.description,
    duration: opts.persistent ? Infinity : opts.duration,
    id: opts.id,
    action,
  });
}

/** Emite un toast de éxito. Puede llevar "Ver detalles" si se pasa error/context/etc. */
export function notifySuccess(
  _toast: AnyToastFn | undefined,
  opts: InfoNotifyOptions,
) {
  const action = opts.action
    ?? (shouldAttachDetails(opts)
      ? buildDetailsAction({ ...opts, titleFinal: opts.title })
      : undefined);
  sonnerToast.success(opts.title, {
    description: opts.description,
    duration: opts.persistent ? Infinity : opts.duration,
    id: opts.id,
    action,
  });
}

/** Emite un toast informativo (neutro). Puede llevar "Ver detalles". */
export function notifyInfo(
  _toast: AnyToastFn | undefined,
  opts: InfoNotifyOptions,
) {
  const action = opts.action
    ?? (shouldAttachDetails(opts)
      ? buildDetailsAction({ ...opts, titleFinal: opts.title })
      : undefined);
  sonnerToast(opts.title, {
    description: opts.description,
    duration: opts.persistent ? Infinity : opts.duration,
    id: opts.id,
    action,
  });
}

