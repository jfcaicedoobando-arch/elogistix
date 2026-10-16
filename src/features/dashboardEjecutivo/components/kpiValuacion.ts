import { formatCurrency } from "@/lib/formatters/numbers";

export function importeEjecutivo(importe: number, incompleto?: boolean): string {
  return `${incompleto ? "Parcial: " : ""}${formatCurrency(importe, "MXN")}`;
}
