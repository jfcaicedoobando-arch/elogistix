import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { CHART_TICK } from "@/lib/chartTokens";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatCompactNumber } from "@/lib/formatters/numbers";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { LineChart as LineChartIcon } from "lucide-react";
import type { FlujoProyectado } from "@/features/tesoreria/services";

interface Props {
  flujo: FlujoProyectado;
}

export function MiniFlujoCard({ flujo }: Props) {
  const data = flujo.semanas.map((s) => ({
    semana: s.semana_iso.split("-")[1],
    saldo: s.saldo_proyectado_mxn,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Flujo proyectado 4 semanas</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length < 2 ? (
          <EmptyStateInline icon={LineChartIcon} message="No hay suficientes datos para graficar la tendencia." hint="Se necesitan al menos 2 semanas." />
        ) : (
        <div className="h-48">
          <p className="text-label text-muted-foreground mb-1">MXN</p>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="semana" tick={CHART_TICK} />
              <YAxis tick={CHART_TICK} tickFormatter={(v) => formatCompactNumber(v)} />
              <Tooltip content={<ChartTooltip formatValue={(v) => formatCompactNumber(v)} />} />
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="saldo"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
