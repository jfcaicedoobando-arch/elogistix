/**
 * Gráfico de tendencia de cargas (Operaciones).
 * Extraído de `pages/dashboard/Operaciones.tsx` para permitir lazy-load de
 * `recharts` (sub-loop 5.3). Sólo se monta cuando la página termina su
 * primer paint, evitando bloquear el TTI con los ~95 KB gzip del chunk.
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: Array<{ mes: string; creadas: number; llegadas: number }>;
}

export default function OperacionesTendenciaChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <RechartsTooltip />
        <Line
          type="monotone"
          dataKey="creadas"
          name="Por ETD"
          stroke="hsl(var(--kpi-info))"
          strokeWidth={2}
          dot={{ r: 4, fill: "hsl(var(--kpi-info))" }}
        />
        <Line
          type="monotone"
          dataKey="llegadas"
          name="Llegadas"
          stroke="hsl(var(--kpi-success))"
          strokeWidth={2}
          dot={{ r: 4, fill: "hsl(var(--kpi-success))" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
