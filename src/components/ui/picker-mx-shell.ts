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

/**
 * Clases del contenedor externo (trigger + mensaje de error).
 * `w-full` asegura que todos los pickers ocupen el ancho de su celda/campo,
 * igual en páginas y en modales; un `w-40`/`w-[180px]` en la prop `className`
 * lo sigue sobreescribiendo vía tailwind-merge.
 */
export const pickerRootClass = "flex w-full min-w-0 flex-col gap-1";

/** Clases del icono de calendario (idéntico en los tres pickers). */
export const pickerIconClass = "h-4 w-4 shrink-0 opacity-70";

/** Clases del botón/afordancia para limpiar el valor. */
export const pickerClearClass =
  "shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground";

/** Clases del icono (X) del botón de limpiar. */
export const pickerClearIconClass = "h-3.5 w-3.5";
