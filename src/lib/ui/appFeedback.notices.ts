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

/**
 * Ola 17 · Higiene de toasts: id estable para deduplicar toasts de
 * éxito/aviso/info cuando el usuario da doble clic rápido. Si el call site no
 * pasa `id`, se deriva de `method` (o del título) para que el segundo toast
 * reemplace al primero en lugar de apilarse.
 */
function idDedupe(opts: InfoNotifyOptions, prefijo: string): string | number | undefined {
  if (opts.id !== undefined) return opts.id;
  const base = opts.method ?? opts.errorCode ?? opts.title;
  return base ? `${prefijo}-${base}` : undefined;
}

/** Acción "Ver detalles" cuando hay payload de debug (o la del call site). */
function accionDetalles(opts: InfoNotifyOptions) {
  return opts.action
    ?? (shouldAttachDetails(opts)
      ? buildDetailsAction({ ...opts, titleFinal: opts.title })
      : undefined);
}

/** Emite un toast de advertencia (no bloquea). Puede llevar "Ver detalles". */
export function notifyWarning(
  _toast: AnyToastFn | undefined,
  opts: InfoNotifyOptions,
) {
  const action = accionDetalles(opts);
  const descripcionSaneada = sanitizeToastText(opts.description);
  const dedupeKey = computeToastDedupeKey("warning", opts.title, descripcionSaneada);
  if (shouldSuppressDuplicateToast(dedupeKey)) return;
  sonnerToast.warning(opts.title, {
    description: descripcionSaneada,
    duration: opts.persistent ? Infinity : opts.duration,
    id: idDedupe(opts, "warn"),
    action,
  });
}

/** Emite un toast de éxito. Puede llevar "Ver detalles" si se pasa error/context/etc. */
export function notifySuccess(
  _toast: AnyToastFn | undefined,
  opts: InfoNotifyOptions,
) {
  const action = accionDetalles(opts);
  const descripcionSaneada = sanitizeToastText(opts.description);
  const dedupeKey = computeToastDedupeKey("success", opts.title, descripcionSaneada);
  if (shouldSuppressDuplicateToast(dedupeKey)) return;
  sonnerToast.success(opts.title, {
    description: descripcionSaneada,
    duration: opts.persistent ? Infinity : opts.duration,
    id: idDedupe(opts, "ok"),
    action,
  });
}

/** Emite un toast informativo (neutro). Puede llevar "Ver detalles". */
export function notifyInfo(
  _toast: AnyToastFn | undefined,
  opts: InfoNotifyOptions,
) {
  const action = accionDetalles(opts);
  const descripcionSaneada = sanitizeToastText(opts.description);
  const dedupeKey = computeToastDedupeKey("info", opts.title, descripcionSaneada);
  if (shouldSuppressDuplicateToast(dedupeKey)) return;
  sonnerToast(opts.title, {
    description: descripcionSaneada,
    duration: opts.persistent ? Infinity : opts.duration,
    id: idDedupe(opts, "info"),
    action,
  });
}
