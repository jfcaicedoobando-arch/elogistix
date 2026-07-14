/**
 * Helpers puros para EmbarqueStatusChip. Vive en archivo aparte para
 * cumplir la regla `react-refresh/only-export-components`.
 */

export type CobroStatus = "pendiente" | "parcial" | "pagado" | null | undefined;

export interface FinancieroInfo {
  label: string;
  tone: "warning" | "neutral" | "success";
}

export function resolveFinancieroInfo(
  tieneProforma: boolean | null | undefined,
  cobroStatus: CobroStatus,
): FinancieroInfo {
  if (cobroStatus === "pagado") return { label: "Cobrado", tone: "success" };
  if (cobroStatus === "parcial") return { label: "Cobro parcial", tone: "neutral" };
  if (!tieneProforma) return { label: "Sin proforma", tone: "warning" };
  return { label: "Proforma", tone: "neutral" };
}
