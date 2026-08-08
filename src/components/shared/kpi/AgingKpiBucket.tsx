/**
 * `AgingKpiBucket` — tarjeta KPI de una cubeta de antigüedad.
 *
 * Componente ÚNICO para las tres vistas de aging (`/cobranza/aging`,
 * `/compras/aging`, `/reportes/cartera`) para que los cinco recuadros se vean
 * y se comporten igual en todos los módulos.
 */
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import type { TonoKpiAging } from "@/lib/aging/buckets";

interface Props {
  label: string;
  value: number;
  moneda: string;
  tone?: TonoKpiAging;
}

export function AgingKpiBucket({ label, value, moneda, tone = "default" }: Props) {
  return (
    <KpiCard
      label={label}
      value={formatCurrencyCompact(value, moneda)}
      valueTooltip={formatCurrency(value, moneda)}
      variant={tone === "danger" ? "destructive" : tone === "warn" ? "warning" : "default"}
    />
  );
}

/** Alias histórico usado por CxP. */
export { AgingKpiBucket as KpiBucket };
