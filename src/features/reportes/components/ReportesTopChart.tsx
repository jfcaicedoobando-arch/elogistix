import { VACIO_RENTABILIDAD } from "@/types/rentabilidad";
import { formatCurrencyCompact } from "@/lib/formatters";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { formatCurrency } from "@/lib/formatters";
import { CHART, CHART_SERIES as CHART_COLORS } from "@/lib/chartTokens";
import { topChartHeightClass } from "@/features/reportes/domain/topChartHeight";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/shared/useIsMobile";


interface Props {
  data: { name: string; profit: number }[];
  isLoading: boolean;
}

export default function ReportesTopChart({ data, isLoading }: Props) {
  const isMobile = useIsMobile();
  const chartHeightClass = isLoading ? "h-72" : topChartHeightClass(data.length);
  function renderBody() {
    if (isLoading) return <ChartSkeleton height={300} />;
    if (data.length === 0) {
      return <EmptyStateInline icon={BarChart3} message={VACIO_RENTABILIDAD} />;
    }
    // VT-19: con todos los montos en $0 el eje X queda degenerado (tick único
    // "$0"); se muestra empty state en lugar de la gráfica vacía.
    if (data.every((d) => !d.profit)) {
      return <EmptyStateInline icon={BarChart3} message="Sin utilidad registrada en el periodo seleccionado" />;
    }
    if (data.length === 1) {
      return <div className="flex h-full items-center justify-between gap-4 rounded-md border bg-muted/20 p-4"><p className="min-w-0 break-words font-medium">{data[0].name}</p><p className={cn("shrink-0 text-kpi tabular-nums", data[0].profit < 0 && "text-destructive")}>{formatCurrency(data[0].profit, "USD")}</p></div>;
    }
    return (
      <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: isMobile ? 0 : 10, right: isMobile ? 8 : 24, top: 5, bottom: 5 }}>
              <XAxis
                type="number"
                tickCount={isMobile ? 3 : 5}
                domain={([min, max]: readonly [number, number]) => [Math.min(0, min), Math.max(0, max)]}
                allowDecimals={false}
                tickFormatter={(v) => formatCurrencyCompact(Number(v) || 0, "USD")}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={isMobile ? 96 : 210}
                tick={{ fontSize: 11 }}
                // En móvil las etiquetas dejan espacio para las barras; el
                // tooltip y el detalle inferior conservan el nombre completo.
                tickFormatter={(v: string) => {
                  const limit = isMobile ? 12 : 30;
                  return v && v.length > limit ? v.slice(0, limit - 1) + "…" : v;
                }}
              />
              <Tooltip content={<ChartTooltip formatValue={(v) => formatCurrency(v, "USD")} />} />
              <ReferenceLine x={0} stroke={CHART.border} />
              <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                {data.map((row, i) => (
                  <Cell key={i} fill={row.profit < 0 ? CHART.destructive : CHART_COLORS[i % CHART_COLORS.length]} />
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
      <CardContent className={cn(chartHeightClass)}>{renderBody()}</CardContent>
      {isMobile && !isLoading && data.length > 1 && data.some((row) => row.profit !== 0) && (
        <CardContent className="pt-0">
          <details>
            <summary className="min-h-11 cursor-pointer rounded-sm py-2 text-body-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Ver nombres e importes
            </summary>
            <ul className="space-y-2 text-body-sm">
              {data.map((row, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="min-w-0 break-words">{row.name}</span>
                  <span className={cn("font-medium tabular-nums", row.profit < 0 && "text-destructive")}>{formatCurrency(row.profit, "USD")}</span>
                </li>
              ))}
            </ul>
          </details>
        </CardContent>
      )}
    </Card>
  );
}
