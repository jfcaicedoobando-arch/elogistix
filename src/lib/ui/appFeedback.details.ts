/** Helpers para construir la acción "Ver detalles" en toasts. */
import { buildErrorReport } from "./errorReport";
import { openErrorReport, rememberErrorReport, offerErrorRecovery } from "@/lib/diagnostics/errorDetailsStore";
import type { InfoNotifyOptions } from "./appFeedback.types";

export function shouldAttachDetails(opts: InfoNotifyOptions): boolean {
  return Boolean(
    opts.showDetails
    || opts.error !== undefined
    || opts.context !== undefined
    || opts.method
    || opts.payload !== undefined
    || opts.requestId
    || opts.errorCode
    || opts.phase
    || opts.step !== undefined
    || opts.errors,
  );
}

export function buildDetailsAction(opts: InfoNotifyOptions & { titleFinal: string; phase?: string }) {
  const debug = buildErrorReport({
    title: opts.titleFinal,
    description: opts.description,
    phase: opts.phase,
    error: opts.error,
    context: opts.context,
    errorCode: opts.errorCode,
    method: opts.method,
    requestId: opts.requestId,
    payload: opts.payload,
    step: opts.step,
    errors: opts.errors,
  });
  if (opts.error !== undefined || opts.showDetails) rememberErrorReport(debug);
  return {
    label: "Ver detalles",
    onClick: () => openErrorReport(debug),
    onToastClose: () => offerErrorRecovery(debug),
  };
}
