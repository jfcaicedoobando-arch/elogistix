/**
 * `<MargenBadge />` — badge canónico para porcentajes de margen/rentabilidad.
 *
 * Ola 5 · 5.6: sustituye los helpers locales (`margenBadge` en Reportes,
 * `tonoProfit` en Cotización, condicionales inline en Proyección). El tono
 * sale siempre de `@/lib/ui/margen`, así que un 12 % se ve igual en todos
 * los módulos que usen la misma escala.
 */
import { Badge } from "@/components/ui/badge";
import { formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { claseTonoMargen, tonoMargen, type OpcionesTonoMargen } from "@/lib/ui/margen";

export interface MargenBadgeProps extends OpcionesTonoMargen {
  /** Porcentaje de margen (12.5 = 12.5 %). */
  pct: number | null | undefined;
  /** Etiqueta alternativa (por defecto el porcentaje formateado). */
  label?: string;
  className?: string;
}

export function MargenBadge({ pct, umbrales, venta, label, className }: MargenBadgeProps) {
  const tono = tonoMargen(pct, { umbrales, venta });
  const variant = tono === "neutral" ? "neutral" : tono;
  return (
    <Badge variant={variant} className={className}>
      {label ?? (pct == null ? "—" : formatPercent(pct))}
    </Badge>
  );
}

/** Variante sin recuadro: sólo el porcentaje coloreado (tablas densas). */
export function MargenTexto({ pct, umbrales, venta, className }: Omit<MargenBadgeProps, "label">) {
  return (
    <span className={cn("tabular-nums", claseTonoMargen(pct, { umbrales, venta }), className)}>
      {pct == null ? "—" : formatPercent(pct)}
    </span>
  );
}
