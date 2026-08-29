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
import { shouldAttachDetails } from "./appFeedback.details";
import { notifyWarning } from "./appFeedback.notices";
import { shouldReportToSentry } from "./appFeedback.sentry";
import { sanitizeToastText } from "./sanitizeToastText";
import { computeToastDedupeKey, shouldSuppressDuplicateToast } from "./appFeedback.dedupe";
import type { AnyToastFn, ErrorNotifyOptions } from "./appFeedback.types";


/** Q-08 · ids de los toasts de error vivos, para poder descartar SÓLO errores
 *  al cambiar de ruta sin borrar confirmaciones de éxito. */
const ERROR_TOAST_IDS = new Set<string>();

export * from "./appFeedback.types";
export * from "./appFeedback.sentry";

/** Emite un toast bloqueante (error) con payload de debug copiable. */
/** Título por defecto del toast de error según paso/fase (extraído para
 *  mantener `notifyError` bajo el límite de complejidad del linter). */
function tituloPorDefecto(step: number | undefined, phase: string | undefined): string {
  if (typeof step === "number") {
    const label = STEP_LABELS[step] ?? `Paso ${step}`;
    return `Revisa el Paso ${step}: ${label}`;
  }
  if (phase) return `Error: ${phase}`;
  return "Error";
}


/** Emisión del toast de error (id estable, dedupe y acción "Ver detalles").
 *  Extraída de `notifyError` para respetar el tope de complejidad. */
function emitirToastError(args: {
  opts: ErrorNotifyOptions;
  computedTitle: string;
  description: string | undefined;
  debug: ReturnType<typeof buildErrorReport>;
}) {
  const { opts, computedTitle, description, debug } = args;
  const { phase, error, context, errorCode, method, payload, requestId, action } = opts;
  // P-05 / FIX-R3: id por código → fase → `method`; con fallback fijo "generic"
  // dos errores sin código en <8 s se reemplazaban entre sí.
  const errorToastId = `err-${errorCode ?? phase ?? method ?? "generic"}`;
  const dedupeKey = computeToastDedupeKey("error", computedTitle, description);
  if (shouldSuppressDuplicateToast(dedupeKey)) return;
  ERROR_TOAST_IDS.add(errorToastId);
  // "Ver detalles" sólo si hay algo que mostrar (no un botón muerto).
  const hayDetalle = shouldAttachDetails({ title: computedTitle, error, context, errorCode, method, payload, requestId });
  const detallesAction = hayDetalle ? { label: "Ver detalles", onClick: () => openErrorReport(debug) } : undefined;
  sonnerToast.error(computedTitle, {
    description,
    // P-05: dedupe por código de error (reemplaza en vez de apilar) y
    // auto-dismiss a 8s: los toasts persistentes tapaban los botones del header.
    id: errorToastId,
    duration: 8000,
    // Q-08: si hay acción primaria (Reintentar), "Ver detalles" baja a secundaria.
    action: action ?? detallesAction,
    cancel: action ? detallesAction : undefined,
  });
}

export function notifyError(_toast: AnyToastFn | undefined, opts: ErrorNotifyOptions) {
  const {
    step, phase, errors, message, description: descOpt, title, error, context,
    errorCode, method, payload, requestId,
  } = opts;
  // R-07: nunca imprimimos HTML crudo (páginas de error de proxy) en el toast.
  const description = sanitizeToastText(
    descOpt ?? message ?? (errors ? Object.values(errors)[0] : undefined),
  );

  // v13.792.1 — Errores de dominio ESPERADOS (`expected: true`, p. ej.
  // `BuzonDuplicadoError` del buzón CxP): no son fallas, son validaciones de
  // negocio. Se muestran como aviso amable con el mensaje del error, SIN
  // "Ver detalles" (no hay nada que depurar) y SIN reporte a Sentry.
  if ((error as { expected?: unknown } | null | undefined)?.expected === true) {
    notifyWarning(undefined, {
      title: sanitizeToastText(title) ?? "Aviso",
      description: description ?? (error instanceof Error ? sanitizeToastText(error.message) : undefined),
    });
    return;
  }

  // R-07: el título también puede venir de `err.message` con HTML crudo.
  const computedTitle =
    sanitizeToastText(title) ?? tituloPorDefecto(step, phase);

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

  emitirToastError({ opts, computedTitle, description, debug });

  // 13.301.59: a Sentry sólo error real (no auth / validación / red transitoria).
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

/** Toasts no bloqueantes (aviso / éxito / info) — ver `appFeedback.notices`. */
export { notifyWarning, notifySuccess, notifyInfo } from "./appFeedback.notices";


/** Descarta SÓLO los toasts de error vivos (p. ej. al cambiar de ruta, Q-08).
 *  Las confirmaciones de éxito/aviso sobreviven a la navegación para que el
 *  usuario alcance a leer "Guardado correctamente" tras un redirect.
 *  Punto único de acceso a `sonner` para no importarlo desde componentes. */
export function dismissAllToasts() {
  for (const id of ERROR_TOAST_IDS) sonnerToast.dismiss(id);
  ERROR_TOAST_IDS.clear();
}
