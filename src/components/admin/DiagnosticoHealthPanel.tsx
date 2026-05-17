/**
 * DiagnosticoHealthPanel — KPIs + tendencia + top funciones con errores.
 * Consume `app_logs_health_summary` y `app_logs_health_timeline`.
 */
import { useState } from "react";
import { Activity, AlertTriangle, Clock, Bug } from "lucide-react";
import {
  Bar,
  BarChart,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  computeKpis,
  useAppLogsHealthSummary,
  useAppLogsHealthTimeline,
  type HealthSummaryRow,
} from "@/hooks/admin/useAppLogsHealth";

const RANGE_OPTIONS: Array<{ label: string; hours: number; buckets: number }> = [
  { label: "Última hora", hours: 1, buckets: 12 },
  { label: "Últimas 6 horas", hours: 6, buckets: 18 },
  { label: "Últimas 24 horas", hours: 24, buckets: 24 },
  { label: "Últimos 7 días", hours: 24 * 7, buckets: 28 },
];

function formatMs(v: number | null): string {
  if (v === null) return "—";
  return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;
}

function formatBucket(iso: string, hours: number): string {
  const d = new Date(iso);
  if (hours <= 24) return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" });
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "error";
}) {
  const toneCls =
    tone === "error"
      ? "text-destructive"
      : tone === "warn"
      ? "text-amber-600"
      : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <div className={`mt-2 text-2xl font-semibold ${toneCls}`}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function DiagnosticoHealthPanel() {
  const [rangeIdx, setRangeIdx] = useState(2); // 24h por defecto
  const range = RANGE_OPTIONS[rangeIdx];

  const summaryQuery = useAppLogsHealthSummary(range.hours);
  const timelineQuery = useAppLogsHealthTimeline(range.hours, range.buckets);

  const rows: HealthSummaryRow[] = summaryQuery.data ?? [];
  const kpis = computeKpis(rows);

  const top5 = [...rows]
    .filter((r) => r.errors > 0)
    .sort((a, b) => b.errors - a.errors)
    .slice(0, 5);

  const slowest = [...rows]
    .filter((r) => r.p95_ms !== null)
    .sort((a, b) => (b.p95_ms ?? 0) - (a.p95_ms ?? 0))
    .slice(0, 5);

  const timeline = (timelineQuery.data ?? []).map((p) => ({
    label: formatBucket(p.bucket, range.hours),
    total: p.total,
    errors: p.errors,
    warns: p.warns,
  }));

  const loading = summaryQuery.isLoading || timelineQuery.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Salud de la plataforma</h2>
        <Select value={String(rangeIdx)} onValueChange={(v) => setRangeIdx(Number(v))}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((r, i) => (
              <SelectItem key={i} value={String(i)}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Eventos"
          value={kpis.totalEvents.toLocaleString("es-MX")}
          hint={`${rows.length} funciones activas`}
        />
        <KpiCard
          icon={<Bug className="h-4 w-4" />}
          label="Errores"
          value={kpis.totalErrors.toLocaleString("es-MX")}
          hint={`${kpis.errorRatePct.toFixed(2)}% del total`}
          tone={kpis.totalErrors > 0 ? "error" : "default"}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Advertencias"
          value={kpis.totalWarns.toLocaleString("es-MX")}
          tone={kpis.totalWarns > 0 ? "warn" : "default"}
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Funciones con error"
          value={kpis.affectedFns.toLocaleString("es-MX")}
          hint={`en ${range.label.toLowerCase()}`}
          tone={kpis.affectedFns > 0 ? "error" : "default"}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Línea de tiempo de eventos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-44 w-full" />
          ) : timeline.length === 0 ? (
            <div className="text-xs text-muted-foreground py-12 text-center">
              Sin datos en el rango seleccionado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={timeline}>
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
                <Line type="monotone" dataKey="warns" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} name="Avisos" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top 5 funciones con errores</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-44 w-full" />
            ) : top5.length === 0 ? (
              <div className="text-xs text-muted-foreground py-10 text-center">
                Sin errores en el rango seleccionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={top5} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="fn" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="errors" fill="hsl(var(--destructive))" name="Errores" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top 5 más lentas (p95)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-44 w-full" />
            ) : slowest.length === 0 ? (
              <div className="text-xs text-muted-foreground py-10 text-center">
                Sin mediciones de latencia.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Función</th>
                    <th className="text-right py-2 font-medium">p50</th>
                    <th className="text-right py-2 font-medium">p95</th>
                    <th className="text-right py-2 font-medium">Eventos</th>
                  </tr>
                </thead>
                <tbody>
                  {slowest.map((r) => (
                    <tr key={r.fn} className="border-b last:border-0">
                      <td className="py-2 font-mono">{r.fn}</td>
                      <td className="py-2 text-right">{formatMs(r.p50_ms)}</td>
                      <td className="py-2 text-right font-medium">{formatMs(r.p95_ms)}</td>
                      <td className="py-2 text-right">{r.total.toLocaleString("es-MX")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
