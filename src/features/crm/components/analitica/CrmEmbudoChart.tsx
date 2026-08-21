/**
 * Ola 8 · Analítica CRM — gráfica del embudo de conversión por etapa.
 * Colores por tokens (chartTokens); recharts no puede usar clases Tailwind.
 */
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Filter } from "lucide-react";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { CHART_SERIES, CHART_TICK } from "@/lib/chartTokens";

interface Props {
  embudo: { etapa: string; cantidad: number }[];
  isLoading?: boolean;
}

export default function CrmEmbudoChart({ embudo, isLoading }: Props) {
  if (isLoading) return <ChartSkeleton height={260} />;
  if (embudo.length === 0) {
    return <EmptyStateInline icon={Filter} message="Sin datos" />;
  }
  const data = embudo.map((e) => ({ name: e.etapa, cantidad: e.cantidad }));
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <XAxis
            type="number"
            allowDecimals={false}
            tick={CHART_TICK}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={CHART_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} content={<ChartTooltip />} />
          <Bar dataKey="cantidad" name="Oportunidades" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={d.name} fill={CHART_SERIES[i % CHART_SERIES.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
