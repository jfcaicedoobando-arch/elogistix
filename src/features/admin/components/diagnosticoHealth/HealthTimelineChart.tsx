/**
 * Línea de tiempo de eventos / errores / warnings para el panel de salud.
 * Extraído de `DiagnosticoHealthPanel`.
 */
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";

export interface TimelinePoint {
  label: string;
  total: number;
  errors: number;
  warns: number;
}

interface Props {
  loading: boolean;
  data: TimelinePoint[];
}

export default function HealthTimelineChart({ loading, data }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-medium">Línea de tiempo de eventos</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton height={176} />
        ) : data.length === 0 ? (
          <div className="text-xs text-muted-foreground py-12 text-center">
            Sin datos en el rango seleccionado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Total" />
              <Line type="monotone" dataKey="errors" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name="Errores" />
              <Line type="monotone" dataKey="warns" stroke={CHART.warning} strokeWidth={2} dot={false} name="Avisos" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
