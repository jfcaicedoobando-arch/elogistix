/**
 * Store mínimo (useSyncExternalStore) para abrir/cerrar el diálogo global
 * de detalles de error. Permite que cualquier toast destructive con payload
 * de debug active el panel sin acoplarse al árbol de Toaster.
 */
import { useSyncExternalStore } from "react";
import type { ErrorReport } from "@/lib/ui/errorReport";

type State = { report: ErrorReport | null };

let state: State = { report: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function openErrorReport(report: ErrorReport): void {
  state = { report };
  emit();
}

export function closeErrorReport(): void {
  state = { report: null };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): State {
  return state;
}

export function useErrorReport(): ErrorReport | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).report;
}
