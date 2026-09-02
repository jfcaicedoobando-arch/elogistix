import { lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { TrendingUp, AlertTriangle, Container, Ship, RefreshCw } from "lucide-react";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { MAX_CONTENEDORES, type PeriodoFiltro } from "@/features/operaciones/hooks";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { KpiCard } from "@/components/shared/KpiCard";
import { KpiErrorCard } from "@/features/operaciones/components/KpiErrorCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { DesempenoOperadores } from "@/features/operaciones/components/DesempenoOperadores";
import { useOperacionesPageController } from "@/features/operaciones/hooks";
import { useTarifasPendientesAprobacion } from "@/features/costeo/hooks/useTarifasPendientesAprobacion";
import { PageContainer } from "@/components/shared/PageContainer";
import { CargaGuard } from "@/components/shared/states/CargaGuard";

// Lazy: difiere recharts (~95 KB gzip) fuera del TTI.
const OperacionesTendenciaChart = lazy(
  () => import("@/features/operaciones/components/OperacionesTendenciaChart"),
);

export default function Operaciones() {
  const {
    periodo, setPeriodo,
    operadorChart, setOperadorChart,
    isLoading, isError, refetch, operadores, global,
    hoyStr, chartData,
    creadasEsteMes, llegadasEsteMes,
    balancePct, contPct, totalAlertas,
  } = useOperacionesPageController();
  const {
    data: tarifasPendientes,
    isLoading: isLoadingTarifasPendientes,
    isError: isErrorTarifasPendientes,
    refetch: refetchTarifasPendientes,
  } = useTarifasPendientesAprobacion();

  function renderTendenciaChart() {
    if (isLoading) return <ChartSkeleton height={260} />;
    return (
      <Suspense fallback={<ChartSkeleton height={260} />}>
        <OperacionesTendenciaChart data={chartData} />
      </Suspense>
    );
  }


  return (
    <PageContainer>
      <CargaGuard
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        errorTitle="No pudimos cargar el dashboard de operaciones"
        errorDescription="Revisa tu conexión e intenta de nuevo."
      >
      <PageHeader
        title="Dashboard de Operaciones"
        description={hoyStr}
        actions={
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoFiltro)}>
            <SelectTrigger className="h-9 w-auto min-w-[140px] gap-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Este mes</SelectItem>
              <SelectItem value="3meses">Últimos 3 meses</SelectItem>
              <SelectItem value="anio">Este año</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Cargas activas" value={global.totalActivas} icon={Ship} variant="info" iconVariant="chip" loading={isLoading} />
        <KpiCard label="Contenedores (TEU)" value={`${global.totalContenedores} / ${MAX_CONTENEDORES}`} icon={Container} variant="accent" iconVariant="chip" loading={isLoading}>
          {!isLoading && <Progress value={contPct} className="h-1.5 mt-1.5 [&>div]:bg-kpi-accent" />}
        </KpiCard>
        {/* VB-28: la moneda ya la muestra el valor ("USD …"); no duplicarla en el label. */}
        <KpiCard label="Utilidad" value={formatCurrencyCompact(global.totalProfit, "USD")} valueTooltip={formatCurrency(global.totalProfit, "USD")} icon={TrendingUp} variant="success" iconVariant="chip" loading={isLoading} />
        <KpiCard label="Alertas" value={totalAlertas} sublabel={totalAlertas > 0 ? `${global.totalCriticos} críticos · ${global.totalEnPuerto} en puerto` : "Sin alertas"} icon={AlertTriangle} variant="destructive" iconVariant="chip" loading={isLoading} />
        {isErrorTarifasPendientes ? (
          <KpiErrorCard onRetry={() => refetchTarifasPendientes()} />
        ) : (
          <KpiCard
            label="Tarifas por aprobar"
            value={tarifasPendientes ?? 0}
            sublabel={(tarifasPendientes ?? 0) > 0 ? "Esperando primera aprobación" : "Al día"}
            icon={RefreshCw}
            variant={(tarifasPendientes ?? 0) > 0 ? "destructive" : "info"}
            iconVariant="chip"
            loading={isLoading || isLoadingTarifasPendientes}
            to="/costeo/tarifas?aprobacion=borrador"
          />
        )}
      </div>

      <DesempenoOperadores operadores={operadores} isLoading={isLoading} />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Ship className="h-4 w-4 text-muted-foreground" />
              Tendencia de cargas
            </CardTitle>
            <Select value={operadorChart} onValueChange={setOperadorChart}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos los operadores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los operadores</SelectItem>
                {operadores.map((op) => <SelectItem key={op.nombre} value={op.nombre}>{op.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-kpi-info-soft p-3 text-center">
              <p className="text-xs text-kpi-info font-medium">ETD este mes</p>
              <p className="text-kpi text-kpi-info">{creadasEsteMes}</p>
            </div>
            <div className="rounded-xl bg-kpi-success-soft p-3 text-center">
              <p className="text-xs text-kpi-success font-medium">Llegadas este mes</p>
              <p className="text-kpi text-kpi-success">{llegadasEsteMes}</p>
            </div>
            <div className="rounded-xl bg-kpi-accent p-3 text-center">
              <p className="text-xs text-primary-foreground/80 font-medium">Activas hoy</p>
              <p className="text-kpi text-primary-foreground">{global.activasHoy}</p>
            </div>
          </div>

          {renderTendenciaChart()}

          <Separator className="my-4" />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Balance ETD/llegadas</span>
            <Progress value={Math.min(balancePct, 100)} className={`h-2 flex-1 ${balancePct >= 100 ? "[&>div]:bg-success" : "[&>div]:bg-warning"}`} />
            <span className="text-xs font-medium">{balancePct}%</span>
          </div>
        </CardContent>
      </Card>
      </CargaGuard>
    </PageContainer>
  );
}
