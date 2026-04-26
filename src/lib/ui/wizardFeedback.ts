/**
 * Helpers unificados para emitir toasts del wizard con severidades consistentes.
 * Estándar (v8.95.0):
 *   - error → toast destructive (bloqueante)
 *   - warning → toast warning (no bloquea)
 *   - success → toast success
 *
 * Mantiene un único punto de cambio para tono y formato.
 */
import { STEP_LABELS } from "@/lib/domain/embarqueWizardSchemas";

type ToastFn = (props: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "warning" | "success";
}) => unknown;

export interface ErrorNotifyOptions {
  /** Número de paso del wizard (1..4). Si se da, genera título "Revisa el Paso N: <nombre>". */
  step?: number;
  /** Fase de operación (ej. "subida de documentos"). Genera "Error: <fase>". */
  phase?: string;
  /** Errores por campo (formato `Campo: razón.`). Toma el primero como descripción. */
  errors?: Record<string, string>;
  /** Mensaje libre alternativo a `errors`. */
  message?: string;
  /** Override de título. */
  title?: string;
}

export function notifyError(toast: ToastFn, opts: ErrorNotifyOptions) {
  const { step, phase, errors, message, title } = opts;
  const description = message ?? (errors ? Object.values(errors)[0] : undefined);

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

  toast({ title: computedTitle, description, variant: "destructive" });
}

export function notifyWarning(
  toast: ToastFn,
  opts: { title: string; description?: string },
) {
  toast({ title: opts.title, description: opts.description, variant: "warning" });
}

export function notifySuccess(
  toast: ToastFn,
  opts: { title: string; description?: string },
) {
  toast({ title: opts.title, description: opts.description, variant: "success" });
}
