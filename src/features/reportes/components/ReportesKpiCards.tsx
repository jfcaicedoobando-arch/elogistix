import { Users, DollarSign, TrendingUp, Percent, AlertTriangle, type LucideIcon } from "lucide-react";
import { KpiCard, type KpiVariant } from "@/components/shared/KpiCard";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";

interface Kpis {
  totalClientes: number;
  revenue: number;
  profit: number;
  margenProm: number;
  embarquesSinTc: number;
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
    <div className="space-y-3">
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
      {!isLoading && kpis.embarquesSinTc > 0 ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-body-sm text-warning"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {kpis.embarquesSinTc === 1
              ? "Hay 1 embarque sin tipo de cambio resuelto."
              : `Hay ${kpis.embarquesSinTc} embarques sin tipo de cambio resuelto.`}{" "}
            Las cifras de venta, utilidad y margen mostradas están INCOMPLETAS: no se sumó
            correctamente ese embarque. No representan el total exacto.
          </span>
        </div>
      ) : null}
    </div>
  );
}
