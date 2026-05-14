import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.85)",
  "hsl(var(--primary) / 0.7)",
  "hsl(var(--primary) / 0.6)",
  "hsl(var(--primary) / 0.5)",
  "hsl(var(--primary) / 0.45)",
  "hsl(var(--primary) / 0.4)",
  "hsl(var(--primary) / 0.35)",
  "hsl(var(--primary) / 0.3)",
  "hsl(var(--primary) / 0.25)",
];

interface Props {
  data: { name: string; profit: number }[];
  isLoading: boolean;
}

export default function ReportesTopChart({ data, isLoading }: Props) {
  function renderBody() {
    if (isLoading) return <Skeleton className="h-full w-full" />;
    if (data.length === 0) {
      return <p className="text-sm text-muted-foreground pt-10 text-center">Sin datos en el periodo seleccionado</p>;
    }
    return (
      <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 24, top: 5, bottom: 5 }}>
              <XAxis
                type="number"
                tickCount={5}
                domain={[0, "dataMax"]}
                allowDecimals={false}
                tickFormatter={(v) => {
                  const n = Number(v) || 0;
                  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
                  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
                  return `$${n}`;
                }}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={170}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => (v && v.length > 22 ? v.slice(0, 21) + "…" : v)}
              />
              <Tooltip formatter={(v: number) => formatCurrency(v, "USD")} />
              <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <Card className="lg:col-span-2 rounded-2xl shadow-sm border-0 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" /> Top {Math.min(data.length, 10)} por Profit
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[350px]">{renderBody()}</CardContent>
    </Card>
  );
}
