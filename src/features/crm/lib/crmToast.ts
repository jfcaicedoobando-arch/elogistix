/**
 * crmToast — toasts minimalistas y silenciados para el módulo CRM.
 *
 * v13.308.7 — Trazabilidad opcional:
 *  - success/info aceptan un segundo argumento `{ error?, context?, method? }`.
 *    Si viene, delegan en `notifySuccess`/`notifyInfo` con acción "Ver
 *    detalles". Sin él, siguen siendo toasts silenciados de 2 s.
 *  - error sigue delegando en `notifyError` (persistente + panel copiable).
 *  - undo mantiene su acción "Deshacer" a 5 s.
 *
 * Usar SIEMPRE en el módulo CRM en lugar de `notifySuccess(undefined, {...})`
 * cuando el mensaje es un simple "X creado/actualizado/eliminado".
 */

import {
  notifyError,
  notifySuccess,
  notifyInfo,
} from "@/lib/ui/appFeedback";

interface DebugOpts {
  error?: unknown;
  context?: Record<string, unknown>;
  method?: string;
}

function success(message: string, opts?: DebugOpts): void {
  if (opts && (opts.error !== undefined || opts.context || opts.method)) {
    notifySuccess(undefined, {
      title: message,
      duration: 2000,
      error: opts.error,
      context: opts.context,
      method: opts.method ?? "CRM_TOAST_SUCCESS",
    });
    return;
  }
  notifySuccess(undefined, { title: message, duration: 2000 });
}

function error(message: string, err?: unknown): void {
  const description =
    err instanceof Error ? err.message : typeof err === "string" ? err : undefined;
  notifyError(undefined, { title: message, description, error: err, method: "CRM_TOAST" });
}

function info(message: string, opts?: DebugOpts): void {
  if (opts && (opts.error !== undefined || opts.context || opts.method)) {
    notifyInfo(undefined, {
      title: message,
      duration: 2000,
      error: opts.error,
      context: opts.context,
      method: opts.method ?? "CRM_TOAST_INFO",
    });
    return;
  }
  notifyInfo(undefined, { title: message, duration: 2000 });
}

function undo(message: string, onUndo: () => void | Promise<void>): void {
  notifyInfo(undefined, {
    title: message,
    duration: 5000,
    action: { label: "Deshacer", onClick: () => { void onUndo(); } },
  });
}

export const crmToast = { success, error, info, undo };
