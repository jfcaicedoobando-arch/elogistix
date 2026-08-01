/**
 * Estilos compartidos por los pickers de fecha localizados (MX) para que
 * `DatePickerMx`, `DateTimePickerMx` y `MonthPickerMx` muestren exactamente el
 * mismo aspecto en los estados vacío / deshabilitado / con error.
 *
 * v13.389.3 — antes cada picker tenía su propio trigger: los de mes y
 * fecha-hora usaban `Button variant="outline"` (sin estados de error ni
 * deshabilitado), por lo que un formulario podía verse inconsistente.
 */

/** Placeholder canónico de los pickers de sólo fecha. */
export const PLACEHOLDER_FECHA = "DD/MM/AAAA";
/** Placeholder canónico del picker de fecha + hora. */
export const PLACEHOLDER_FECHA_HORA = "DD/MM/AAAA HH:MM";
/** Placeholder canónico del selector de periodo mensual. */
export const PLACEHOLDER_PERIODO = "Mes AAAA";

/** Mensaje por defecto cuando el texto capturado no es una fecha válida. */
export const MENSAJE_FECHA_INVALIDA = "Fecha inválida. Usa DD/MM/AAAA.";

export interface PickerTriggerState {
  showError?: boolean;
  disabled?: boolean;
  /** Sin valor: el texto se muestra atenuado (placeholder). */
  empty?: boolean;
}

/** Clases del contenedor/trigger de un picker MX. */
export function pickerTriggerClass({ showError, disabled, empty }: PickerTriggerState): string {
  return [
    "inline-flex w-full items-center h-10 rounded-md border border-input bg-background px-2 gap-1 text-sm",
    "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0",
    showError ? "border-destructive focus-within:ring-destructive" : "",
    disabled ? "opacity-50 cursor-not-allowed bg-muted" : "",
    empty ? "text-muted-foreground" : "",
  ].filter(Boolean).join(" ");
}

/** Clases del texto de error debajo de un picker MX. */
export const pickerErrorClass = "text-xs text-destructive";
