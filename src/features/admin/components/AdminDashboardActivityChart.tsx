/**
 * Gráfico de actividad por organización (AdminDashboard).
 * Extraído para permitir lazy-load de `recharts` (sub-loop 5.3).
 */
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { CHART_TICK, CHART_LEGEND_STYLE, CHART_BAR_RADIUS } from "@/lib/chartTokens";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend,
  CartesianGrid,
} from "recharts";

interface Props {
  data: Array<{ nombre: string; embarques: number; cotizaciones: number }>;
}

export default function AdminDashboardActivityChart({ data }: Props) {
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="nombre" tick={CHART_TICK} />
          <YAxis tick={CHART_TICK} allowDecimals={false} />
          <RTooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} />
          <Bar dataKey="embarques" name="Embarques" fill="hsl(var(--primary))" radius={CHART_BAR_RADIUS} />
          <Bar dataKey="cotizaciones" name="Cotizaciones" fill="hsl(var(--info))" radius={CHART_BAR_RADIUS} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
