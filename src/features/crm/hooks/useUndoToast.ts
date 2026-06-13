/**
 * useUndoToast — helper para toasts minimalistas con acción "Deshacer".
 * El callback `undo` se dispara cuando el usuario hace click en deshacer.
 */
import { toast } from "sonner";

export function showUndoToast(message: string, undo: () => void | Promise<void>): void {
  toast(message, {
    duration: 5000,
    action: { label: "Deshacer", onClick: () => { void undo(); } },
  });
}
