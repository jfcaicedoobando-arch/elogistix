/**
 * /crm — Resumen ejecutivo del CRM.
 * Sólo KPIs y gráficas de lectura rápida (totales, embudo, forecast mensual,
 * leaderboard). Las tareas accionables (NBA, actividades hoy, deals cerrando)
 * viven en /crm/mi-dia. El desglose completo (motivos de pérdida, conversión
 * por fuente, tablas largas) sigue en /crm/analitica.
 */
import { Activity, Filter, Target, TrendingUp, Trophy, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { formatCurrency, formatCurrencyCompact, porcentajeEntero } from "@/lib/formatters";
import { useCrmInicioVM, useForecast, useReportesCRM } from "@/features/crm/hooks";
import LeaderboardVendedores from "@/features/crm/components/LeaderboardVendedores";
import { useDocumentTitle } from "@/hooks/shared";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Hint } from "@/components/shared/Hint";

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
function StatStripItem({
  icon: Icon,
  label,
  value,
  valueTooltip,
}: {
  icon: typeof Target;
  label: string;
  value: string | number;
  /** Valor completo cuando `value` viene en notación compacta (MXN 304.4K). */
  valueTooltip?: string;
}) {
  return (
    <Card className="flex items-center gap-3 px-4 h-14 rounded-md sm:rounded-none sm:border-0 sm:border-r last:sm:border-r-0 sm:shadow-none">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-label text-muted-foreground truncate">{label}</div>
        <Hint label={valueTooltip}>
          <div className="text-base font-semibold tabular-nums truncate">
            {value}
          </div>
        </Hint>
      </div>
    </Card>
  );
}

const v = (loading: boolean, n: number | undefined): string | number => (loading ? "…" : (n ?? 0));
const fmt = (n: number) => formatCurrencyCompact(n, "MXN");

function EmbudoCard() {
  const { data, isLoading } = useReportesCRM();
  const embudo = data?.embudo ?? [];
  const max = embudo.reduce((m, e) => Math.max(m, e.cantidad), 0) || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Embudo de oportunidades</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <EmptyStateInline loading message="Cargando…" />
        ) : embudo.length === 0 ? (
          <EmptyStateInline icon={Filter} message="Sin oportunidades aún." />
        ) : (
          <ul className="space-y-2">
            {embudo.map((e) => {
              const pct = porcentajeEntero(e.cantidad, max, { minimo: 2 }) ?? 2;
              return (
                <li key={e.etapa} className="space-y-1">
                  <div className="flex justify-between text-body">
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
        <CardTitle>Forecast por mes</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <EmptyStateInline loading message="Cargando…" />
        ) : porMes.length === 0 ? (
          <EmptyStateInline icon={TrendingUp} message="Sin datos para los próximos meses." />
        ) : (
          <Table className="w-full text-body">
            <TableHeader>
              <TableRow className="text-body-sm text-muted-foreground border-b">
                <DetailTableHead>Mes</DetailTableHead>
                <DetailTableHead className="text-right">Ponderado</DetailTableHead>
                <DetailTableHead className="text-right">Ganado</DetailTableHead>
                <DetailTableHead className="text-right">#</DetailTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porMes.map((b) => (
                <TableRow key={b.key} className="border-b last:border-0">
                  <TableCell>{b.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(b.ponderado)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(b.ganado)}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
  const totalesPorMoneda = forecast?.totalesPorMoneda ?? [];

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

        {/* Ola 9 — antes eran KpiCard grandes sin contexto junto a la tira de
            arriba: dos lenguajes visuales de KPI en la misma pantalla. Ahora
            comparten la tira canónica y llevan encabezado que las explica. */}
        <section className="space-y-2">
          <SectionHeading as="h2" variant="overline">
            Forecast del mes
          </SectionHeading>
          {loadingForecast ? (
            <KpiStrip desktopCols={3} className="sm:border sm:rounded-md sm:bg-card sm:overflow-hidden sm:gap-0">
              <StatStripItem icon={TrendingUp} label="Pipeline" value="…" />
              <StatStripItem icon={Target} label="Ponderado" value="…" />
              <StatStripItem icon={Trophy} label="Ganado" value="…" />
            </KpiStrip>
          ) : totalesPorMoneda.length === 0 ? (
            <KpiStrip desktopCols={3} className="sm:border sm:rounded-md sm:bg-card sm:overflow-hidden sm:gap-0">
              <StatStripItem icon={TrendingUp} label="Pipeline" value={fmt(0)} />
              <StatStripItem icon={Target} label="Ponderado" value={fmt(0)} />
              <StatStripItem icon={Trophy} label="Ganado" value={fmt(0)} />
            </KpiStrip>
          ) : (
            totalesPorMoneda.map((t) => (
              <KpiStrip
                key={t.moneda}
                desktopCols={3}
                className="sm:border sm:rounded-md sm:bg-card sm:overflow-hidden sm:gap-0"
              >
                <StatStripItem
                  icon={TrendingUp}
                  label={`Pipeline (${t.moneda})`}
                  value={formatCurrencyCompact(t.totalPipeline, t.moneda)}
                  valueTooltip={formatCurrency(t.totalPipeline, t.moneda)}
                />
                <StatStripItem
                  icon={Target}
                  label={`Ponderado (${t.moneda})`}
                  value={formatCurrencyCompact(t.totalPonderado, t.moneda)}
                  valueTooltip={formatCurrency(t.totalPonderado, t.moneda)}
                />
                <StatStripItem
                  icon={Trophy}
                  label={`Ganado (${t.moneda})`}
                  value={formatCurrencyCompact(t.totalGanado, t.moneda)}
                  valueTooltip={formatCurrency(t.totalGanado, t.moneda)}
                />
              </KpiStrip>
            ))
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EmbudoCard />
          <ForecastMesCard />
        </div>

        <LeaderboardVendedores />
      </CargaGuard>
    </PageContainer>
  );
}
