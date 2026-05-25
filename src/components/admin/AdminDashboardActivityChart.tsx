/**
 * Gráfico de actividad por organización (AdminDashboard).
 * Extraído para permitir lazy-load de `recharts` (sub-loop 5.3).
 */
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
          <XAxis dataKey="nombre" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
          <RTooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="embarques" name="Embarques" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="cotizaciones" name="Cotizaciones" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
