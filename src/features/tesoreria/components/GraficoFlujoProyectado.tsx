/**
 * Gráfico combinado de barras (entradas/salidas) + línea de saldo proyectado.
 */
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { SemanaFlujo } from "@/features/tesoreria/services";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters/numbers";

interface Props { semanas: SemanaFlujo[] }

export default function GraficoFlujoProyectado({ semanas }: Props) {
  const data = semanas.map((s) => ({
    semana: s.semana_iso.slice(5),
    Entradas: Math.round(s.entradas_mxn),
    Salidas: -Math.round(s.salidas_mxn),
    Saldo: Math.round(s.saldo_proyectado_mxn),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(Number(v), "MXN")} />
        <RTooltip formatter={(v: number) => formatCurrency(Math.abs(v), "MXN")} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Entradas" fill="hsl(var(--kpi-success))" />
        <Bar dataKey="Salidas" fill="hsl(var(--destructive))" />
        <Line type="monotone" dataKey="Saldo" stroke="hsl(var(--kpi-info))" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
