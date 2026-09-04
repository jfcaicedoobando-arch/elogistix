/**
 * /crm — Resumen ejecutivo del CRM.
 * Sólo KPIs y gráficas de lectura rápida (totales, embudo, forecast mensual,
 * leaderboard). Las tareas accionables (NBA, actividades hoy, deals cerrando)
 * viven en /crm/mi-dia. El desglose completo (motivos de pérdida, conversión
 * por fuente, tablas largas) sigue en /crm/analitica.
 */
import { Activity, Filter, Target, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { formatCurrencyCompact, porcentajeEntero } from "@/lib/formatters";
import { useCrmInicioVM, useForecast, useReportesCRM } from "@/features/crm/hooks";
import { primerDiaMesMx, ultimoDiaMesMx } from "@/lib/date/mx";
import LeaderboardVendedores from "@/features/crm/components/LeaderboardVendedores";
import { CrmForecastMesKpis } from "@/features/crm/components/CrmForecastMesKpis";
import { CrmStatStripItem as StatStripItem } from "@/features/crm/components/CrmStatStripItem";
import { useDocumentTitle } from "@/hooks/shared";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
const v = (loading: boolean, n: number | undefined): string | number => (loading ? "…" : (n ?? 0));

function EmbudoCard() {
  const { data, isLoading, isError, refetch } = useReportesCRM();
  const embudo = data?.embudo ?? [];
  const max = embudo.reduce((m, e) => Math.max(m, e.cantidad), 0) || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Embudo de oportunidades</CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <ErrorStateInline message="No se pudo cargar el embudo." onRetry={refetch} />
        ) : isLoading ? (
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
  // FIX-8 (auditoría): mes en curso + 5 siguientes (calendario MX), no los
  // 6 meses más antiguos que hubiera en la base.
  const { data, isLoading, isError, refetch } = useForecast(primerDiaMesMx(0), ultimoDiaMesMx(5));
  const porMes = data?.porMes ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Forecast por mes</CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <ErrorStateInline message="No se pudo cargar el forecast." onRetry={refetch} />
        ) : isLoading ? (
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
                  <TableCell>{`${b.label} (${b.moneda})`}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrencyCompact(b.ponderado, b.moneda)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrencyCompact(b.ganado, b.moneda)}</TableCell>
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
          <StatStripItem icon={Users} label="Leads en cartera" value={v(isLoading, vm.kpis.leads)} />
          <StatStripItem icon={Target} label="Oportunidades abiertas" value={v(isLoading, vm.kpis.oportunidadesAbiertas)} />
          <StatStripItem icon={Activity} label="Actividades pendientes" value={v(isLoading, vm.kpis.actividadesPendientes)} />
          {/* Hallazgo #5: nunca sumar monedas distintas ni etiquetarlas como MXN. */}
          <StatStripItem
            icon={TrendingUp}
            label="Pipeline ponderado"
            value={
              isLoading
                ? "…"
                : vm.kpis.pipelinePonderadoPorMoneda.length > 1
                  ? "Varias monedas"
                  : formatCurrencyCompact(
                      vm.kpis.pipelinePonderadoPorMoneda[0]?.total ?? 0,
                      vm.kpis.pipelinePonderadoPorMoneda[0]?.moneda ?? "MXN",
                    )
            }
            valueTooltip={
              vm.kpis.pipelinePonderadoPorMoneda.length > 1
                ? vm.kpis.pipelinePonderadoPorMoneda
                    .map((s) => formatCurrencyCompact(s.total, s.moneda))
                    .join(" · ")
                : undefined
            }
          />

        </KpiStrip>

        <CrmForecastMesKpis />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EmbudoCard />
          <ForecastMesCard />
        </div>

        <LeaderboardVendedores />
      </CargaGuard>
    </PageContainer>
  );
}
