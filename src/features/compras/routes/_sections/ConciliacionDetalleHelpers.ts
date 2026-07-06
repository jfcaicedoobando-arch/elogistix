/**
 * Constantes y helpers puros compartidos por el panel de conciliación.
 * Separado de los componentes para que react-refresh funcione bien.
 */
import type { EstatusRenglon } from "@/features/embarques/services/reconciliacionCostos";

export const ESTATUS_META: Record<
  EstatusRenglon,
  { label: string; variant: "outline" | "default" | "secondary" | "destructive"; dot: string }
> = {
  sin_match:  { label: "Sin match",  variant: "destructive", dot: "bg-destructive" },
  parcial:    { label: "Parcial",    variant: "secondary",   dot: "bg-warning" },
  conciliado: { label: "Conciliado", variant: "default",     dot: "bg-success" },
  excedente:  { label: "Excedente",  variant: "destructive", dot: "bg-destructive" },
};

export type ResumenTileTone = "destructive" | "success" | "muted" | "default";

export function toneFromNumber(n: number): ResumenTileTone {
  if (n > 0) return "destructive";
  if (n < 0) return "success";
  return "muted";
}

export function classFromNumber(n: number): string {
  if (n > 0) return "text-destructive";
  if (n < 0) return "text-success";
  return "text-muted-foreground";
}
