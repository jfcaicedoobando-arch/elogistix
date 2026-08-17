import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from "recharts";
import { formatCompactNumber } from "@/lib/formatters/numbers";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { LineChart as LineChartIcon } from "lucide-react";
import type { PuntoEERR } from "@/features/dashboardEjecutivo/services";

interface Props {
  data: PuntoEERR[];
}

export function GraficoEERR12m({ data }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>EERR últimos 12 meses</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length < 2 ? (
          <EmptyStateInline icon={LineChartIcon} message="No hay suficientes datos para graficar la tendencia." hint="Se necesitan al menos 2 periodos." />
        ) : (
        <div className="h-64">
          <p className="text-2xs text-muted-foreground mb-1">MXN</p>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} />
              <Tooltip
                formatter={(v: number) => formatCompactNumber(v)}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ingresos" name="Ingresos" fill="hsl(var(--primary))" />
              <Bar dataKey="costos" name="Costos" fill="hsl(var(--destructive))" />
              <Line
                type="monotone"
                dataKey="utilidad"
                name="Utilidad"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
