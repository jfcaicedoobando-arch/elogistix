import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from "recharts";
import { formatCurrencyCompact } from "@/lib/formatters/numbers";
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
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(v, "MXN")} />
              <Tooltip
                formatter={(v: number) => formatCurrencyCompact(v, "MXN")}
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
      </CardContent>
    </Card>
  );
}
