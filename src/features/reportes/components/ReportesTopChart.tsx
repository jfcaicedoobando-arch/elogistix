import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { formatCurrency } from "@/lib/formatters";
import { CHART_SERIES as CHART_COLORS } from "@/lib/chartTokens";


interface Props {
  data: { name: string; profit: number }[];
  isLoading: boolean;
}

export default function ReportesTopChart({ data, isLoading }: Props) {
  function renderBody() {
    if (isLoading) return <ChartSkeleton height={300} />;
    if (data.length === 0) {
      return <EmptyStateInline icon={BarChart3} message="Sin datos en el periodo seleccionado" />;
    }
    // VT-19: con todos los montos en $0 el eje X queda degenerado (tick único
    // "$0"); se muestra empty state en lugar de la gráfica vacía.
    if (data.every((d) => !d.profit)) {
      return <EmptyStateInline icon={BarChart3} message="Sin utilidad registrada en el periodo seleccionado" />;
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
                width={210}
                tick={{ fontSize: 11 }}
                // VT-19/VF-24: no truncar antes de ~30 chars; hay ancho de sobra.
                tickFormatter={(v: string) => (v && v.length > 30 ? v.slice(0, 29) + "…" : v)}
              />
              <Tooltip content={<ChartTooltip formatValue={(v) => formatCurrency(v, "USD")} />} />
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
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" /> Top {Math.min(data.length, 10)} por utilidad
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[350px]">{renderBody()}</CardContent>
    </Card>
  );
}
