/**
 * Helpers de formato compartidos por la tabla de reconciliación a 3 columnas.
 */
import type { ClasificacionVarianza } from "@/lib/domain/versionadoCotizacion";

export const fmt = (n: number, moneda: string): string =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda || "USD" }).format(n);

export const pct = (n: number): string => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export function colorPorClasificacion(c: ClasificacionVarianza): string {
  switch (c) {
    case "critica":
      return "bg-destructive/10 text-destructive";
    case "alerta":
      return "bg-warning/10 text-warning-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}
