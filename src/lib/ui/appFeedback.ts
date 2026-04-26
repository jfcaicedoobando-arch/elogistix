/**
 * Helpers unificados para emitir toasts en TODA la aplicación con severidades
 * consistentes (v8.97.0).
 *
 * Estándar:
 *   - error     → toast destructive (bloqueante / fallo de operación)
 *   - warning   → toast warning (no bloquea pero requiere atención)
 *   - success   → toast success (cualquier "guardado / creado / eliminado / actualizado")
 *
 * Mantiene un único punto de cambio para tono y formato. Reemplaza el viejo
 * `wizardFeedback.ts` (que sigue funcionando como re-export para compatibilidad).
 */
import { STEP_LABELS } from "@/lib/domain/embarqueWizardSchemas";

type ToastFn = (props: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "warning" | "success";
}) => unknown;

export interface ErrorNotifyOptions {
  /** Número de paso del wizard (1..4). Genera título "Revisa el Paso N: <nombre>". */
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

/** Emite un toast bloqueante (variant destructive). */
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

/** Emite un toast de advertencia (no bloquea). */
export function notifyWarning(
  toast: ToastFn,
  opts: { title: string; description?: string },
) {
  toast({ title: opts.title, description: opts.description, variant: "warning" });
}

/** Emite un toast de éxito (cualquier confirmación de acción exitosa). */
export function notifySuccess(
  toast: ToastFn,
  opts: { title: string; description?: string },
) {
  toast({ title: opts.title, description: opts.description, variant: "success" });
}
