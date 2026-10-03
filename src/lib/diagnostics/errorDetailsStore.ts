/**
 * Store mínimo (useSyncExternalStore) para abrir/cerrar el diálogo global
 * de detalles de error. Permite que cualquier toast destructive con payload
 * de debug active el panel sin acoplarse al árbol de Toaster.
 */
import { useSyncExternalStore } from "react";
import type { ErrorReport } from "@/lib/diagnostics/errorReportTypes";
import { invalidateErrorReportScopes, isCurrentErrorReport } from "./errorReportScope";

type State = { report: ErrorReport | null; latest: ErrorReport | null; recoverable: boolean };

let state: State = { report: null, latest: null, recoverable: false };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function openErrorReport(report: ErrorReport): void {
  if (!isCurrentErrorReport(report)) return;
  state = { ...state, report, recoverable: false };
  emit();
}

export function closeErrorReport(): void {
  state = { ...state, report: null, recoverable: state.latest !== null };
  emit();
}

/** One report in memory only; not persisted to storage or the database. */
export function rememberErrorReport(report: ErrorReport): void {
  if (!isCurrentErrorReport(report)) return;
  state = { ...state, latest: report, recoverable: false };
  emit();
}

export function offerErrorRecovery(report?: ErrorReport): void {
  if (report && state.latest !== report) return;
  state = { ...state, recoverable: state.latest !== null };
  emit();
}

export function clearErrorReports(): void {
  invalidateErrorReportScopes();
  state = { report: null, latest: null, recoverable: false };
  emit();
}

export function useRecoverableErrorReport(): ErrorReport | null {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return current.recoverable ? current.latest : null;
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
