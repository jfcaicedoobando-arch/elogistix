/**
 * Helpers unificados para emitir toasts en TODA la aplicación con severidades
 * consistentes (v8.96.0).
 *
 * Estándar:
 *   - error     → toast destructive (bloqueante / fallo de operación)
 *   - warning   → toast warning (no bloquea pero requiere atención)
 *   - success   → toast success (cualquier "guardado / creado / eliminado / actualizado")
 *
 * Mantiene un único punto de cambio para tono y formato. Reemplaza al antiguo
 * `wizardFeedback.ts` cuya naming sugería uso exclusivo del wizard.
 *
 * El parámetro `toast` se tipa de forma muy permisiva (`AnyToastFn`) para
 * aceptar tanto el `toast` de `@/hooks/use-toast` (con variantes shadcn que
 * incluyen warning/success) como el de sonner u otros wrappers.
 */
import { STEP_LABELS } from "@/lib/domain/embarqueWizardSchemas";
import { buildErrorReport } from "@/lib/ui/errorReport";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToastFn = (props: any) => unknown;

export interface ErrorNotifyOptions {
  /** Número de paso del wizard (1..4). Genera título "Revisa el Paso N: <nombre>". */
  step?: number;
  /** Fase de operación (ej. "subida de documentos"). Genera "Error: <fase>". */
  phase?: string;
  /** Errores por campo (formato `Campo: razón.`). Toma el primero como descripción. */
  errors?: Record<string, string>;
  /** Mensaje libre alternativo a `errors` (sinónimo de `description`). */
  message?: string;
  /** Descripción libre del error (alias preferido para llamadas simples). */
  description?: string;
  /** Override de título. */
  title?: string;
  /** Error original (Error, PostgrestError, string...) — habilita panel de detalles. */
  error?: unknown;
  /** Datos arbitrarios que ayudan a reproducir (embarqueId, bucket, path, etc.). */
  context?: Record<string, unknown>;
}

/** Emite un toast bloqueante (variant destructive) con payload de debug copiable. */
export function notifyError(toast: AnyToastFn, opts: ErrorNotifyOptions) {
  const { step, phase, errors, message, description: descOpt, title, error, context } = opts;
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
  });

  toast({ title: computedTitle, description, variant: "destructive", debug });
}

/** Emite un toast de advertencia (no bloquea). */
export function notifyWarning(
  toast: AnyToastFn,
  opts: { title: string; description?: string },
) {
  toast({ title: opts.title, description: opts.description, variant: "warning" });
}

/** Emite un toast de éxito (cualquier confirmación de acción exitosa). */
export function notifySuccess(
  toast: AnyToastFn,
  opts: { title: string; description?: string },
) {
  toast({ title: opts.title, description: opts.description, variant: "success" });
}
