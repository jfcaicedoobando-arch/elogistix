/**
 * Gráfico combinado de barras (entradas/salidas) + línea de saldo proyectado.
 *
 * v13.735.0 — E-4: en móvil (<768px) se reduce la densidad de ticks del eje X
 * y se envuelve en un contenedor con scroll horizontal y ancho mínimo para
 * que el eje y la leyenda no se corten (antes desbordaban la tarjeta a 375px).
 */
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { SemanaFlujo } from "@/features/tesoreria/services";
import { formatCurrency, formatCompactNumber } from "@/lib/formatters/numbers";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { useIsMobile } from "@/hooks/shared";
import { LineChart as LineChartIcon } from "lucide-react";

interface Props { semanas: SemanaFlujo[] }

export default function GraficoFlujoProyectado({ semanas }: Props) {
  const isMobile = useIsMobile();
  const data = semanas.map((s) => ({
    semana: s.semana_iso.slice(5),
    Entradas: Math.round(s.entradas_mxn),
    Salidas: -Math.round(s.salidas_mxn),
    Saldo: Math.round(s.saldo_proyectado_mxn),
  }));

  if (data.length < 2) {
    return (
      <EmptyStateInline icon={LineChartIcon} message="No hay suficientes datos para graficar la tendencia." hint="Se necesitan al menos 2 semanas." />
    );
  }

  // En móvil se muestra ~1 de cada 2 etiquetas del eje X para que no se
  // amontonen, y el contenedor crece a un ancho mínimo con scroll horizontal
  // en vez de comprimir la gráfica hasta cortar ejes/leyenda.
  const tickInterval = isMobile ? Math.ceil(data.length / 6) : 0;
  const minWidth = isMobile ? Math.max(data.length * 48, 480) : undefined;

  return (
    <div>
      <p className="text-2xs text-muted-foreground mb-1">MXN</p>
      <div className="overflow-x-auto [scrollbar-width:thin]">
        <div style={minWidth ? { minWidth } : undefined}>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="semana" tick={{ fontSize: 11 }} interval={tickInterval} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(Number(v))} />
              <RTooltip content={<ChartTooltip formatValue={(v) => formatCurrency(Math.abs(v), "MXN")} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Entradas" fill="hsl(var(--kpi-success))" />
              <Bar dataKey="Salidas" fill="hsl(var(--destructive))" />
              <Line type="monotone" dataKey="Saldo" stroke="hsl(var(--kpi-info))" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
