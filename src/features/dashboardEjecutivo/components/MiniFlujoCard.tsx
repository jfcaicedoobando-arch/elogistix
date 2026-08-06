import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatCurrencyCompact } from "@/lib/formatters/numbers";
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
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(v, "MXN")} />
              <Tooltip
                formatter={(v: number) => formatCurrencyCompact(v, "MXN")}
                contentStyle={{ fontSize: 12 }}
              />
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
      </CardContent>
    </Card>
  );
}
