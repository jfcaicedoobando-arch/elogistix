import { Users, DollarSign, TrendingUp, Percent } from "lucide-react";
import { KpiCard } from "@/components/operaciones/KpiCard";
import { formatCurrency } from "@/lib/formatters";
import type { KpiTone } from "@/lib/ui/kpiTones";

interface Kpis {
  totalClientes: number;
  revenue: number;
  profit: number;
  margenProm: number;
}

export default function ReportesKpiCards({ kpis, isLoading }: { kpis: Kpis; isLoading: boolean }) {
  const cards: Array<{ label: string; value: string; icon: React.ElementType; tone: KpiTone }> = [
    { label: "Clientes con operaciones", value: String(kpis.totalClientes), icon: Users, tone: "info" },
    { label: "Revenue total USD", value: formatCurrency(kpis.revenue, "USD"), icon: DollarSign, tone: "success" },
    { label: "Profit total USD", value: formatCurrency(kpis.profit, "USD"), icon: TrendingUp, tone: "accent" },
    { label: "Margen promedio", value: kpis.margenProm.toFixed(1) + "%", icon: Percent, tone: "warning" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((k) => (
        <KpiCard key={k.label} titulo={k.label} valor={k.value} icono={k.icon} color={k.tone} loading={isLoading} />
      ))}
    </div>
  );
}
