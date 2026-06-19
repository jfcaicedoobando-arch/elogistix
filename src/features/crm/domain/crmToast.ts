/**
 * crmToast — toasts minimalistas y silenciados para el módulo CRM.
 *
 * Reglas:
 *  - success/info: 2s, sin descripción, sonner básico.
 *  - error: persistente hasta dismiss (delegamos al wrapper general si el caller
 *    quiere panel copiable; aquí sólo mensaje breve).
 *  - undo: 5s con acción "Deshacer".
 *
 * Usar SIEMPRE en el módulo CRM en lugar de `notifySuccess(toast, {...})`
 * cuando el mensaje es un simple "X creado/actualizado/eliminado".
 */
import { toast } from "sonner";

import { notifyError } from "@/components/shared/utils/appFeedback";
function success(message: string): void {
  toast.success(message, { duration: 2000 });
}

function error(message: string, err?: unknown): void {
  const description =
    err instanceof Error ? err.message : typeof err === "string" ? err : undefined;
  notifyError(toast, { title: message, description, error: err, method: "CRM_TOAST" });
}


function info(message: string): void {
  toast(message, { duration: 2000 });
}

function undo(message: string, onUndo: () => void | Promise<void>): void {
  toast(message, {
    duration: 5000,
    action: { label: "Deshacer", onClick: () => { void onUndo(); } },
  });
}

export const crmToast = { success, error, info, undo };
