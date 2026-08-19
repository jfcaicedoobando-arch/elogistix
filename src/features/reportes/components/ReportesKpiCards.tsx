import { Users, DollarSign, TrendingUp, Percent, type LucideIcon } from "lucide-react";
import { KpiCard, type KpiVariant } from "@/components/shared/KpiCard";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";

interface Kpis {
  totalClientes: number;
  revenue: number;
  profit: number;
  margenProm: number;
}

/**
 * v13.302.3: migrado al `KpiCard` canónico (`iconVariant="chip"`).
 * v13.5xx: sin "arcoíris" — plano por defecto, color sólo en alarma (margen negativo).
 */
export default function ReportesKpiCards({ kpis, isLoading }: { kpis: Kpis; isLoading: boolean }) {
  const cards: Array<{ label: string; value: string; tooltip?: string; icon: LucideIcon; variant: KpiVariant }> = [
    { label: "Clientes con operaciones", value: String(kpis.totalClientes), icon: Users, variant: "default" },
    { label: "Venta total USD", value: formatCurrencyCompact(kpis.revenue, "USD"), tooltip: formatCurrency(kpis.revenue, "USD"), icon: DollarSign, variant: "default" },
    { label: "Utilidad total USD", value: formatCurrencyCompact(kpis.profit, "USD"), tooltip: formatCurrency(kpis.profit, "USD"), icon: TrendingUp, variant: "default" },
    { label: "Margen promedio", value: kpis.margenProm.toFixed(1) + "%", icon: Percent, variant: kpis.margenProm < 0 ? "destructive" : "default" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((k) => (
        <KpiCard
          key={k.label}
          label={k.label}
          value={k.value}
          valueTooltip={k.tooltip}
          icon={k.icon}
          variant={k.variant}
          iconVariant="chip"
          loading={isLoading}
        />
      ))}
    </div>
  );
}
