/**
 * Ola 8 · Analítica CRM — forecast mensual: pipeline, ponderado y ganado por
 * mes de cierre estimado. Colores por tokens (chartTokens).
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

export default function CrmForecastMensualChart({ porMes, isLoading }: Props) {
  if (isLoading) return <ChartSkeleton height={260} />;
  if (porMes.length === 0) {
    return <EmptyStateInline icon={BarChart3} message="Sin datos" />;
  }
  const data = porMes.map((b) => ({
    mes: b.label,
    Pipeline: b.pipeline,
    Ponderado: b.ponderado,
    Ganado: b.ganado,
  }));
  return (
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
            content={<ChartTooltip formatValue={(v) => formatCurrency(v, "MXN")} />}
          />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} />
          <Bar dataKey="Pipeline" fill={CHART.primary} radius={CHART_BAR_RADIUS} />
          <Bar dataKey="Ponderado" fill={CHART.info} radius={CHART_BAR_RADIUS} />
          <Bar dataKey="Ganado" fill={CHART.success} radius={CHART_BAR_RADIUS} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
