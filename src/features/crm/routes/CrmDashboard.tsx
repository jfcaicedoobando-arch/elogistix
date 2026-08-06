"use memo";
/**
 * /crm — Resumen ejecutivo del CRM.
 * Sólo KPIs y gráficas de lectura rápida (totales, embudo, forecast mensual,
 * leaderboard). Las tareas accionables (NBA, actividades hoy, deals cerrando)
 * viven en /crm/mi-dia. El desglose completo (motivos de pérdida, conversión
 * por fuente, tablas largas) sigue en /crm/analitica.
 */
import { Activity, Target, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/KpiCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useCrmInicioVM, useForecast, useReportesCRM } from "@/features/crm/hooks";
import LeaderboardVendedores from "@/features/crm/components/LeaderboardVendedores";
import { useDocumentTitle } from "@/hooks/shared";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

function StatStripItem({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string | number }) {
  return (
    <Card className="flex items-center gap-3 px-4 h-14 rounded-md sm:rounded-none sm:border-0 sm:border-r last:sm:border-r-0 sm:shadow-none">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-label text-muted-foreground truncate">{label}</div>
        <div className="text-base font-semibold tabular-nums truncate">{value}</div>
      </div>
    </Card>
  );
}

const v = (loading: boolean, n: number | undefined): string | number => (loading ? "…" : (n ?? 0));
const fmt = (n: number) => formatCurrencyCompact(n, "MXN");

function TotalCard({ label, value, isLoading }: { label: string; value: number; isLoading: boolean }) {
  return <KpiCard label={label} value={isLoading ? "…" : fmt(value)} />;
}

function EmbudoCard() {
  const { data, isLoading } = useReportesCRM();
  const embudo = data?.embudo ?? [];
  const max = embudo.reduce((m, e) => Math.max(m, e.cantidad), 0) || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Embudo de oportunidades</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <EmptyStateInline loading message="Cargando…" />
        ) : embudo.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin oportunidades aún.</p>
        ) : (
          <ul className="space-y-2">
            {embudo.map((e) => {
              const pct = Math.max(2, Math.round((e.cantidad / max) * 100));
              return (
                <li key={e.etapa} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="truncate">{e.etapa}</span>
                    <span className="font-semibold tabular-nums">{e.cantidad}</span>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ForecastMesCard() {
  const { data, isLoading } = useForecast();
  const porMes = (data?.porMes ?? []).slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Forecast por mes</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <EmptyStateInline loading message="Cargando…" />
        ) : porMes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos para los próximos meses.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-1.5">Mes</th>
                <th className="text-right">Ponderado</th>
                <th className="text-right">Ganado</th>
                <th className="text-right">#</th>
              </tr>
            </thead>
            <tbody>
              {porMes.map((b) => (
                <tr key={b.key} className="border-b last:border-0">
                  <td className="py-1.5">{b.label}</td>
                  <td className="text-right tabular-nums">{fmt(b.ponderado)}</td>
                  <td className="text-right tabular-nums">{fmt(b.ganado)}</td>
                  <td className="text-right tabular-nums">{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export default function CrmDashboard() {
  useDocumentTitle('Resumen ejecutivo CRM');
  const vm = useCrmInicioVM();
  const { isLoading, isError, refetch } = vm;
  const { data: forecast, isLoading: loadingForecast } = useForecast();
  const f = forecast ?? { totalPipeline: 0, totalPonderado: 0, totalGanado: 0 };

  return (
    <PageContainer>
      <PageHeader
        title="Resumen ejecutivo"
        description="Indicadores y gráficas de lectura rápida del CRM"
      />

      <CargaGuard
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorTitle="No se pudo cargar el resumen del CRM"
        errorDescription="Revisa tu conexión y vuelve a intentar."
      >
        <KpiStrip desktopCols={4} className="sm:border sm:rounded-md sm:bg-card sm:overflow-hidden sm:gap-0">
          <StatStripItem icon={Users} label="Leads" value={v(isLoading, vm.kpis.leads)} />
          <StatStripItem icon={Target} label="Oportunidades abiertas" value={v(isLoading, vm.kpis.oportunidadesAbiertas)} />
          <StatStripItem icon={Activity} label="Actividades pendientes" value={v(isLoading, vm.kpis.actividadesPendientes)} />
          <StatStripItem icon={TrendingUp} label="Pipeline ponderado" value={isLoading ? "…" : formatCurrencyCompact(vm.kpis.pipelinePonderado, "MXN")} />
        </KpiStrip>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TotalCard label="Pipeline" value={f.totalPipeline} isLoading={loadingForecast} />
          <TotalCard label="Ponderado" value={f.totalPonderado} isLoading={loadingForecast} />
          <TotalCard label="Ganado" value={f.totalGanado} isLoading={loadingForecast} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EmbudoCard />
          <ForecastMesCard />
        </div>

        <LeaderboardVendedores />
      </CargaGuard>
    </PageContainer>
  );
}
