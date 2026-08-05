/**
 * DiagnosticoHealthPanel — KPIs + tendencia + top funciones con errores.
 * Subcomponentes en `diagnosticoHealth/`.
 */
import { lazy, Suspense, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import {
  computeKpis,
  useAppLogsHealthSummary,
  useAppLogsHealthTimeline,
  type HealthSummaryRow,
} from "@/features/admin/hooks";
import HealthKpisRow from "@/features/admin/components/diagnosticoHealth/HealthKpisRow";
import HealthSlowestTable from "@/features/admin/components/diagnosticoHealth/HealthSlowestTable";
import { formatFechaEs } from "@/lib/formatters/dates";
import { SectionHeading } from "@/components/shared/SectionHeading";

// Lazy: difiere recharts fuera del TTI del panel de diagnóstico.
const HealthTimelineChart = lazy(
  () => import("@/features/admin/components/diagnosticoHealth/HealthTimelineChart"),
);
const HealthTopErrorsChart = lazy(
  () => import("@/features/admin/components/diagnosticoHealth/HealthTopErrorsChart"),
);


const RANGE_OPTIONS: Array<{ label: string; hours: number; buckets: number }> = [
  { label: "Última hora", hours: 1, buckets: 12 },
  { label: "Últimas 6 horas", hours: 6, buckets: 18 },
  { label: "Últimas 24 horas", hours: 24, buckets: 24 },
  { label: "Últimos 7 días", hours: 24 * 7, buckets: 28 },
];

function formatBucket(iso: string, hours: number): string {
  const d = new Date(iso);
  if (hours <= 24) return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return formatFechaEs(iso, { day: "2-digit", month: "2-digit" });
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
        <SectionHeading>Salud de la plataforma</SectionHeading>
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

      <HealthKpisRow
        totalEvents={kpis.totalEvents}
        totalErrors={kpis.totalErrors}
        totalWarns={kpis.totalWarns}
        affectedFns={kpis.affectedFns}
        errorRatePct={kpis.errorRatePct}
        activeFns={rows.length}
        rangeLabel={range.label}
      />

      <Suspense fallback={<ChartSkeleton height={260} />}>
        <HealthTimelineChart loading={loading} data={timeline} />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Suspense fallback={<ChartSkeleton height={260} />}>
          <HealthTopErrorsChart loading={loading} data={top5} />
        </Suspense>
        <HealthSlowestTable loading={loading} data={slowest} />
      </div>
    </div>
  );
}
