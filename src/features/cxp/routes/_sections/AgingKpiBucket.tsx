/**
 * `KpiBucket` — cubeta de aging CxP.
 *
 * v13.426.0 — Armonización visual global: dejó de reimplementar `Card` y ahora
 * compone la tarjeta KPI canónica (`@/components/shared/KpiCard`).
 */
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";

interface Props {
  label: string;
  value: number;
  moneda: string;
  tone?: "default" | "warn" | "danger";
}

export function KpiBucket({ label, value, moneda, tone = "default" }: Props) {
  return (
    <KpiCard
      label={label}
      value={formatCurrencyCompact(value, moneda)}
      valueTooltip={formatCurrency(value, moneda)}
      variant={tone === "danger" ? "destructive" : tone === "warn" ? "warning" : "default"}
    />
  );
}
