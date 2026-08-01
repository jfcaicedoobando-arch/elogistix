/**
 * Gráfico apilado de carga de trabajo por operador (Desempeño).
 * Extraído para permitir lazy-load de `recharts` (sub-loop 5.3).
 */
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { ESTADOS_KEYS, type ChartRow } from "@/features/operaciones/hooks";
import { ESTADO_COLOR, ESTADO_LABEL } from "./desempenoVisuals";

interface Props {
  data: ChartRow[];
}

export default function DesempenoOperadoresChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="nombre" tick={{ fontSize: 11 }} interval={0} height={40} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <RechartsTooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
        />
        {ESTADOS_KEYS.map((estado) => (
          <Bar
            key={estado}
            dataKey={estado}
            name={ESTADO_LABEL[estado]}
            stackId="estados"
            fill={ESTADO_COLOR[estado]}
            radius={estado === "Cerrado" ? [4, 4, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
