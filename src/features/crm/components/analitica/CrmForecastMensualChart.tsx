/**
 * Ola 8 · Analítica CRM — forecast mensual: pipeline, ponderado y ganado por
 * mes de cierre estimado. Colores por tokens (chartTokens).
 * P1-5: los buckets vienen por mes+moneda; se renderiza un mini-gráfico por
 * moneda para no mezclar montos de monedas distintas en la misma barra.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { formatCompactNumber, formatCurrency } from "@/lib/formatters";
import {
  CHART,
  CHART_AXIS_STROKE,
  CHART_BAR_RADIUS,
  CHART_LEGEND_STYLE,
  CHART_TICK,
} from "@/lib/chartTokens";
import type { ForecastBucket } from "@/features/crm/domain/forecast";

interface Props {
  porMes: ForecastBucket[];
  isLoading?: boolean;
}

function agruparPorMoneda(porMes: ForecastBucket[]): Map<string, ForecastBucket[]> {
  const m = new Map<string, ForecastBucket[]>();
  for (const b of porMes) {
    const arr = m.get(b.moneda) ?? [];
    arr.push(b);
    m.set(b.moneda, arr);
  }
  return m;
}

export default function CrmForecastMensualChart({ porMes, isLoading }: Props) {
  if (isLoading) return <ChartSkeleton height={260} />;
  if (porMes.length === 0) {
    return <EmptyStateInline icon={BarChart3} message="Sin datos" />;
  }
  const porMoneda = agruparPorMoneda(porMes);
  return (
    <div className="space-y-6">
      {Array.from(porMoneda.entries()).map(([moneda, buckets]) => {
        const data = buckets.map((b) => ({
          mes: b.label,
          Pipeline: b.pipeline,
          Ponderado: b.ponderado,
          Ganado: b.ganado,
        }));
        return (
          <div key={moneda}>
            <div className="text-body-sm font-medium text-muted-foreground mb-1">{moneda}</div>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.border} vertical={false} />
                  <XAxis
                    dataKey="mes"
                    tick={CHART_TICK}
                    stroke={CHART_AXIS_STROKE}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={CHART_TICK}
                    stroke={CHART_AXIS_STROKE}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCompactNumber(Number(v))}
                    width={48}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                    content={<ChartTooltip formatValue={(v) => formatCurrency(v, moneda)} />}
                  />
                  <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                  <Bar dataKey="Pipeline" fill={CHART.primary} radius={CHART_BAR_RADIUS} />
                  <Bar dataKey="Ponderado" fill={CHART.info} radius={CHART_BAR_RADIUS} />
                  <Bar dataKey="Ganado" fill={CHART.success} radius={CHART_BAR_RADIUS} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
