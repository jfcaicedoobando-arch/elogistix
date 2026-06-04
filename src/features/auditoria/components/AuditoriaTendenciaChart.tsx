/**
 * Tendencia de 30 días del score y los hallazgos críticos basada en
 * `auditoria_snapshots`. Usa recharts (ya en el bundle del dashboard).
 */
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import { useAuditoriaSnapshots } from "@/hooks/auditoria";

export function AuditoriaTendenciaChart() {
  const { data, isLoading } = useAuditoriaSnapshots(30);

  function renderBody() {
    if (isLoading) return <Skeleton className="h-48 w-full" />;
    if (!data || data.length === 0) {
      return (
        <div className="text-xs text-muted-foreground py-12 text-center">
          Aún no hay snapshots históricos. Vuelve mañana para ver la primera
          tendencia (se captura un snapshot por día automáticamente).
        </div>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={data.map((s) => ({
                fecha: s.fecha.slice(5), // MM-DD
                score: s.score,
                criticos: s.criticos,
                pendientes: s.total_pendientes,
              }))}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="fecha" className="text-[10px]" />
              <YAxis yAxisId="left" className="text-[10px]" domain={[0, 100]} />
              <YAxis
                yAxisId="right"
                orientation="right"
                className="text-[10px]"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: "12px",
                }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="score"
                name="Score"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="criticos"
                name="Críticos"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="pendientes"
                name="Pendientes"
                stroke="hsl(var(--warning))"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="4 2"
              />
          </LineChart>
        </ResponsiveContainer>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Tendencia 30 días
        </CardTitle>
      </CardHeader>
      <CardContent>{renderBody()}</CardContent>
    </Card>
  );
}
