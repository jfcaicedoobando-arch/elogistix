/**
 * Manejo de teclado de `DatePickerMx`, extraído para respetar el límite
 * Power of 10 (≤200 líneas por archivo).
 *
 * Atajos sobre el input de fecha:
 *  - `Enter`                → confirma el texto capturado (no cierra el modal).
 *  - `Alt+ArrowDown` / `F4` → abre el calendario.
 *  - `Escape`               → cierra el calendario y devuelve el foco al input.
 */
export interface DatePickerKeyHandlers {
  open: boolean;
  setOpen: (o: boolean) => void;
  commit: () => void;
  /** El texto capturado aún no está reflejado en el valor confirmado. */
  pendiente: boolean;
  disabled?: boolean;
  readOnly?: boolean;
}

/** Devuelve `true` si el evento fue consumido por el picker. */
export function manejarTeclaFecha(
  e: React.KeyboardEvent<HTMLInputElement>,
  { open, setOpen, commit, pendiente, disabled, readOnly }: DatePickerKeyHandlers,
): boolean {
  if (disabled) return false;

  if (e.key === "Escape" && open) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    return true;
  }

  if (!readOnly && (e.key === "F4" || (e.altKey && e.key === "ArrowDown"))) {
    e.preventDefault();
    setOpen(!open);
    return true;
  }

  if (e.key === "Enter") {
    commit();
    // Si había texto sin confirmar, el primer Enter sólo confirma la fecha;
    // el segundo ya envía el formulario contenedor.
    if (pendiente) e.preventDefault();
    return true;
  }

  return false;
}

