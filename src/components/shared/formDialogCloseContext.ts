/**
 * Cierre guardado de `FormDialogShell`.
 *
 * El shell ya pide confirmación cuando `isDirty` y el usuario cierra con X,
 * Escape o clic fuera. El botón "Cancelar" del footer, en cambio, llamaba
 * `onOpenChange(false)` directo y se saltaba la guarda (pérdida de captura).
 * Este contexto expone el cierre guardado del shell para que cualquier acción
 * del footer lo reutilice sin duplicar el diálogo de confirmación.
 */
import { createContext, useContext } from "react";

export const FormDialogCloseContext = createContext<(() => void) | null>(null);

/**
 * Cierre guardado del `FormDialogShell` más cercano. Fuera de un shell regresa
 * `null` para que el call-site decida (no truena).
 */
export function useFormDialogCerrar(): (() => void) | null {
  return useContext(FormDialogCloseContext);
}
