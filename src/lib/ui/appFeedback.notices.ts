/**
 * Toasts no bloqueantes (aviso / éxito / info).
 *
 * Extraídos de `appFeedback.ts` para respetar el tope de 200 líneas por
 * archivo (Power of 10). Se re-exportan desde `appFeedback.ts`, así que los
 * call sites siguen importando desde `@/lib/ui/appFeedback`.
 */
import { toast as sonnerToast } from "sonner";
import { shouldAttachDetails, buildDetailsAction } from "./appFeedback.details";
import { sanitizeToastText } from "./sanitizeToastText";
import { computeToastDedupeKey, shouldSuppressDuplicateToast } from "./appFeedback.dedupe";
import type { AnyToastFn, InfoNotifyOptions } from "./appFeedback.types";
import { safeReportJson } from "@/lib/diagnostics/safeReportValue";
import { errorToastIdentity } from "./appFeedback.dedupe";

/**
 * Ola 17 · Higiene de toasts: id estable para deduplicar toasts de
 * éxito/aviso/info cuando el usuario da doble clic rápido. Si el call site no
 * pasa `id`, se deriva de `method` (o del título) para que el segundo toast
 * reemplace al primero en lugar de apilarse.
 */
function idDedupe(opts: InfoNotifyOptions, prefijo: string): string | number | undefined {
  if (opts.id !== undefined) return opts.id;
  if (opts.context || opts.requestId) return errorToastIdentity(opts, opts.title).replace(/^err-/, `${prefijo}-`);
  const base = opts.method ?? opts.errorCode ?? opts.title;
  return base ? `${prefijo}-${base}` : undefined;
}

/** Acción "Ver detalles" cuando hay payload de debug (o la del call site). */
function acciones(opts: InfoNotifyOptions) {
  const details = shouldAttachDetails(opts)
    ? buildDetailsAction({ ...opts, titleFinal: opts.title }) : undefined;
  const action = opts.action && details
    ? { ...opts.action, onClick: details.scopeAction(opts.action.onClick) } : opts.action ?? details;
  return { action, cancel: opts.action ? details : undefined,
    onDismiss: details?.onToastClose, onAutoClose: details?.onToastClose };
}

/** Emite un toast de advertencia (no bloquea). Puede llevar "Ver detalles". */
export function notifyWarning(
  _toast: AnyToastFn | undefined,
  opts: InfoNotifyOptions,
) {
  // All warnings can represent a blocked/partial workflow, even without an exception.
  const controls = acciones({ ...opts, showDetails: true });
  const descripcionSaneada = sanitizeToastText(opts.description);
  // Stable ID replaces repeated warnings but always refreshes their JSON.
  sonnerToast.warning(sanitizeToastText(opts.title) ?? "Aviso", {
    description: descripcionSaneada,
    duration: opts.persistent ? Infinity : opts.duration,
    id: idDedupe(opts, "warn"),
    ...controls,
  });
}

/** Emite un toast de éxito. Puede llevar "Ver detalles" si se pasa error/context/etc. */
export function notifySuccess(
  _toast: AnyToastFn | undefined,
  opts: InfoNotifyOptions,
) {
  const controls = acciones(opts);
  const descripcionSaneada = sanitizeToastText(opts.description);
  const dedupeKey = noticeKey("success", opts, descripcionSaneada);
  if (shouldSuppressDuplicateToast(dedupeKey) && !shouldAttachDetails(opts)) return;
  sonnerToast.success(sanitizeToastText(opts.title) ?? "Operación completada", {
    description: descripcionSaneada,
    duration: opts.persistent ? Infinity : opts.duration,
    id: idDedupe(opts, "ok"),
    ...controls,
  });
}

/** Emite un toast informativo (neutro). Puede llevar "Ver detalles". */
export function notifyInfo(
  _toast: AnyToastFn | undefined,
  opts: InfoNotifyOptions,
) {
  const controls = acciones(opts);
  const descripcionSaneada = sanitizeToastText(opts.description);
  const dedupeKey = noticeKey("info", opts, descripcionSaneada);
  if (shouldSuppressDuplicateToast(dedupeKey) && !shouldAttachDetails(opts)) return;
  sonnerToast.info(sanitizeToastText(opts.title) ?? "Información", {
    description: descripcionSaneada,
    duration: opts.persistent ? Infinity : opts.duration,
    id: idDedupe(opts, "info"),
    ...controls,
  });
}

function noticeKey(kind: string, opts: InfoNotifyOptions, description?: string) {
  return computeToastDedupeKey(kind, opts.title, description,
    safeReportJson({ method: opts.method, requestId: opts.requestId, context: opts.context }));
}
