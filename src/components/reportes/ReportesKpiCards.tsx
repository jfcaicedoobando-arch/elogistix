import { Users, DollarSign, TrendingUp, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";

interface Kpis {
  totalClientes: number;
  revenue: number;
  profit: number;
  margenProm: number;
}

export default function ReportesKpiCards({ kpis, isLoading }: { kpis: Kpis; isLoading: boolean }) {
  const cards = [
    { label: "Clientes con operaciones", value: kpis.totalClientes, icon: Users, color: "bg-blue-50 text-blue-600", fmt: (v: number) => String(v) },
    { label: "Revenue total USD", value: kpis.revenue, icon: DollarSign, color: "bg-emerald-50 text-emerald-600", fmt: (v: number) => formatCurrency(v, "USD") },
    { label: "Profit total USD", value: kpis.profit, icon: TrendingUp, color: "bg-violet-50 text-violet-600", fmt: (v: number) => formatCurrency(v, "USD") },
    { label: "Margen promedio", value: kpis.margenProm, icon: Percent, color: "bg-amber-50 text-amber-600", fmt: (v: number) => v.toFixed(1) + "%" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((k) => (
        <Card key={k.label} className="rounded-2xl shadow-sm border-0 bg-card">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`rounded-xl p-3 ${k.color}`}><k.icon className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">{k.label}</p>
              {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> : <p className="text-2xl font-bold text-foreground">{k.fmt(k.value)}</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
