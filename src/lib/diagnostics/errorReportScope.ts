import type { ErrorReport } from "./errorReportTypes";

let generation = 0;
const reportGenerations = new WeakMap<ErrorReport, number>();
const listeners = new Set<() => void>();

/** Captura el ámbito al iniciar trabajo asíncrono, antes de crear su reporte. */
export function captureErrorReportScope(): () => boolean {
  const started = generation;
  return () => started === generation;
}

/** Scope stays in memory, never in the JSON shared with support. */
export function trackErrorReportScope(report: ErrorReport): ErrorReport {
  reportGenerations.set(report, generation);
  return report;
}

export function isCurrentErrorReport(report: ErrorReport): boolean {
  return reportGenerations.get(report) === generation;
}

export function invalidateErrorReportScopes(): void {
  generation += 1;
  for (const listener of listeners) listener();
}

export function subscribeErrorReportScope(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function scopedReportAction(report: ErrorReport, action: () => void): () => void {
  return () => { if (isCurrentErrorReport(report)) action(); };
}
