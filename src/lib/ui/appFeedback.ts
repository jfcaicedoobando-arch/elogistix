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
 * aceptar tanto el `toast` de `@/hooks/shared` (con variantes shadcn que
 * incluyen warning/success) como el de sonner u otros wrappers.
 */
import { STEP_LABELS } from "@/lib/domain/embarqueWizardSchemas";
import { buildErrorReport } from "@/lib/ui/errorReport";

/**
 * Firma laxa común a `@/hooks/shared` (shadcn) y wrappers tipo sonner.
 * Las claves extra (`debug`, etc.) se aceptan vía índice `unknown`.
 */
export type AnyToastFn = (props: Record<string, unknown>) => unknown;

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
  /** Error original (Error, PostgrestError, ZodError, string...) — habilita panel de detalles. */
  error?: unknown;
  /** Datos arbitrarios que ayudan a reproducir (embarqueId, bucket, path, etc.). */
  context?: Record<string, unknown>;
  /** Código estandarizado del catálogo. Si no se pasa, se infiere del error. */
  errorCode?: string;
  /** Acción/método (HTTP o semántico, ej. "POST", "SAVE_DRAFT_COTIZACION"). */
  method?: string;
}

/** Emite un toast bloqueante (variant destructive) con payload de debug copiable. */
export function notifyError(toast: AnyToastFn, opts: ErrorNotifyOptions) {
  const {
    step, phase, errors, message, description: descOpt, title, error, context,
    errorCode, method,
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
