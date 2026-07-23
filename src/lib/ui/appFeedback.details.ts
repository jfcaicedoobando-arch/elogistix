/** Helpers para construir la acción "Ver detalles" en toasts. */
import { buildErrorReport } from "./errorReport";
import { openErrorReport } from "@/lib/diagnostics/errorDetailsStore";
import type { InfoNotifyOptions } from "./appFeedback.types";

export function shouldAttachDetails(opts: InfoNotifyOptions): boolean {
  return Boolean(
    opts.showDetails
    || opts.error !== undefined
    || opts.context !== undefined
    || opts.method
    || opts.payload !== undefined
    || opts.requestId
    || opts.errorCode,
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
  });
  return {
    label: "Ver detalles",
    onClick: () => openErrorReport(debug),
  };
}
