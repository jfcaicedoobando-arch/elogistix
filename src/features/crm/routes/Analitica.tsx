/**
 * /crm/analitica — Vista única (sin sub-tabs). Forecast, embudo, pérdidas y
 * leaderboard apilados verticalmente.
 *
 * Mantiene compatibilidad con el query param `?tab=…` previo: simplemente lo
 * ignora (los enlaces viejos siguen aterrizando aquí).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmSubheader } from "@/features/crm/components/CrmSubheader";
import { formatCurrencyCompact, formatPercent } from "@/lib/formatters";
import { useForecast, useReportesCRM } from "@/features/crm/hooks";
import LeaderboardVendedores from "@/features/crm/components/LeaderboardVendedores";
import { usePermissions, useDocumentTitle } from "@/hooks/shared";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { PageContainer } from "@/components/shared/PageContainer";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { BarChart3, ThumbsDown } from "lucide-react";
import CrmEmbudoChart from "@/features/crm/components/analitica/CrmEmbudoChart";
import CrmForecastMensualChart from "@/features/crm/components/analitica/CrmForecastMensualChart";


import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
import { CeldaMontoAnalitica } from "@/features/crm/routes/CeldaMontoAnalitica";
function ForecastPanel() {
  const { data, isLoading, isError, refetch } = useForecast();
  const totales = data?.totalesPorMoneda ?? [];
  const porMes = data?.porMes ?? [];
  const porVendedor = data?.porVendedor ?? [];
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {totales.length === 0 ? (
          <>
            <KpiCard label="Pipeline" value={formatCurrencyCompact(0, "MXN")} loading={isLoading} />
            <KpiCard label="Ponderado" value={formatCurrencyCompact(0, "MXN")} loading={isLoading} />
            <KpiCard label="Ganado" value={formatCurrencyCompact(0, "MXN")} loading={isLoading} variant="success" />
          </>
        ) : (
          totales.map((t) => (
            <div key={t.moneda} className="grid grid-cols-3 gap-4 col-span-1 md:col-span-3">
              <KpiCard label={`Pipeline (${t.moneda})`} value={formatCurrencyCompact(t.totalPipeline, t.moneda)} loading={isLoading} />
              <KpiCard label={`Ponderado (${t.moneda})`} value={formatCurrencyCompact(t.totalPonderado, t.moneda)} loading={isLoading} />
              <KpiCard label={`Ganado (${t.moneda})`} value={formatCurrencyCompact(t.totalGanado, t.moneda)} loading={isLoading} variant="success" />
            </div>
          ))
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle>Por mes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <CrmForecastMensualChart porMes={porMes} isLoading={isLoading} />
            <div className="overflow-x-auto">

            <Table className="w-full text-body">
              <TableHeader><TableRow className="text-body-sm text-muted-foreground border-b">
                <DetailTableHead>Mes</DetailTableHead><DetailTableHead>Moneda</DetailTableHead><DetailTableHead className="text-right">Pipeline</DetailTableHead><DetailTableHead className="text-right">Ponderado</DetailTableHead><DetailTableHead className="text-right">Ganado</DetailTableHead><DetailTableHead className="text-right">#</DetailTableHead>
              </TableRow></TableHeader>
              <TableBody>
                {porMes.map((b) => (
                  <TableRow key={b.key} className="border-b">
                    <TableCell>{b.label}</TableCell>
                    <TableCell>{b.moneda}</TableCell>
                    <CeldaMontoAnalitica monto={b.pipeline} moneda={b.moneda} />
                    <CeldaMontoAnalitica monto={b.ponderado} moneda={b.moneda} />
                    <CeldaMontoAnalitica monto={b.ganado} moneda={b.moneda} />
                    <TableCell className="text-right">{b.count}</TableCell>
                  </TableRow>
                ))}
                {porMes.length === 0 && <TableRow><TableCell colSpan={6}><EmptyStateInline icon={BarChart3} message="Sin datos" density="compact" /></TableCell></TableRow>}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle>Por vendedor</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table className="w-full text-body">
              <TableHeader><TableRow className="text-body-sm text-muted-foreground border-b">
                <DetailTableHead>Vendedor</DetailTableHead><DetailTableHead>Moneda</DetailTableHead><DetailTableHead className="text-right">Pipeline</DetailTableHead><DetailTableHead className="text-right">Ponderado</DetailTableHead><DetailTableHead className="text-right">Ganado</DetailTableHead><DetailTableHead className="text-right">#</DetailTableHead>
              </TableRow></TableHeader>
              <TableBody>
                {porVendedor.map((b) => (
                  <TableRow key={b.key} className="border-b">
                    <TableCell>{b.label}</TableCell>
                    <TableCell>{b.moneda}</TableCell>
                    <CeldaMontoAnalitica monto={b.pipeline} moneda={b.moneda} />
                    <CeldaMontoAnalitica monto={b.ponderado} moneda={b.moneda} />
                    <CeldaMontoAnalitica monto={b.ganado} moneda={b.moneda} />
                    <TableCell className="text-right">{b.count}</TableCell>
                  </TableRow>
                ))}
                {porVendedor.length === 0 && <TableRow><TableCell colSpan={6}><EmptyStateInline icon={BarChart3} message="Sin datos" density="compact" /></TableCell></TableRow>}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmbudoYPerdidas() {
  const { data, isLoading, isError, refetch } = useReportesCRM();
  const r = data ?? { embudo: [], porFuente: [], motivosPerdida: [] };
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle>Embudo</CardTitle></CardHeader>
        <CardContent>
          <CrmEmbudoChart embudo={r.embudo} isLoading={isLoading} />

        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle>Conversión por fuente</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table className="w-full text-body">
            <TableHeader><TableRow className="text-body-sm text-muted-foreground border-b">
              <DetailTableHead>Fuente</DetailTableHead><DetailTableHead className="text-right">Total</DetailTableHead><DetailTableHead className="text-right">Conv.</DetailTableHead><DetailTableHead className="text-right">Tasa</DetailTableHead>
            </TableRow></TableHeader>
            <TableBody>
              {r.porFuente.map((f) => (
                <TableRow key={f.fuente} className="border-b">
                  <TableCell>{f.fuente}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.total}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.convertidos}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(f.tasa)}</TableCell>
                </TableRow>
              ))}
              {r.porFuente.length === 0 && <TableRow><TableCell colSpan={4}><EmptyStateInline icon={BarChart3} message="Sin datos" density="compact" /></TableCell></TableRow>}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle>Motivos de pérdida</CardTitle></CardHeader>
        <CardContent>
          {r.motivosPerdida.map((m) => (
            <div key={m.motivo} className="flex justify-between py-1 text-body border-b last:border-0">
              <span>{m.motivo}</span><span className="font-semibold tabular-nums">{m.cantidad}</span>
            </div>
          ))}
          {r.motivosPerdida.length === 0 && <EmptyStateInline icon={ThumbsDown} message="Sin oportunidades perdidas" />}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Analitica() {
  useDocumentTitle("Analítica CRM");
  const { canEdit } = usePermissions();
  return (
    <PageContainer>
      <PageHeader
        title="Analítica CRM"
        description="Forecast, embudo de conversión y rendimiento por vendedor"
      />
      <CrmSubheader context="Forecast · Embudo · Pérdidas · Vendedores" />
      <ForecastPanel />
      <EmbudoYPerdidas />
      {canEdit && (
        <Card>
          <CardHeader className="pb-2"><CardTitle>Vendedores</CardTitle></CardHeader>
          <CardContent><LeaderboardVendedores /></CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
