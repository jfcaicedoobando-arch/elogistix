import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, AlertTriangle, Package, Container, Ship } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { MAX_CONTENEDORES, type PeriodoFiltro } from "@/hooks/operaciones/useOperacionesData";
import { formatCurrency } from "@/lib/formatters";
import { KpiCard } from "@/components/operaciones/KpiCard";
import { DesempenoOperadores } from "@/components/operaciones/DesempenoOperadores";
import { useOperacionesPageController } from "@/hooks/operaciones/useOperacionesPageController";

export default function Operaciones() {
  const {
    periodo, setPeriodo,
    operadorChart, setOperadorChart,
    isLoading, operadores, global,
    hoyStr, chartData,
    creadasEsteMes, llegadasEsteMes,
    balancePct, contPct, totalAlertas,
  } = useOperacionesPageController();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard de Operaciones</h1>
          <p className="text-sm text-muted-foreground capitalize">{hoyStr}</p>
        </div>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoFiltro)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Este mes</SelectItem>
            <SelectItem value="3meses">Últimos 3 meses</SelectItem>
            <SelectItem value="anio">Este año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard titulo="Cargas activas" valor={global.totalActivas} icono={Package} color="info" loading={isLoading} />
        <KpiCard titulo="Contenedores" valor={`${global.totalContenedores} / ${MAX_CONTENEDORES}`} icono={Container} color="accent" loading={isLoading}>
          {!isLoading && <Progress value={contPct} className="h-1.5 mt-1.5 [&>div]:bg-kpi-accent" />}
        </KpiCard>
        <KpiCard titulo="Profit total USD" valor={formatCurrency(global.totalProfit, "USD")} icono={TrendingUp} color="success" loading={isLoading} />
        <KpiCard titulo="Alertas de riesgo" valor={totalAlertas} subtitulo={totalAlertas > 0 ? `${global.totalCriticos} críticos · ${global.totalEnPuerto} en puerto` : "Sin alertas"} icono={AlertTriangle} color="danger" loading={isLoading} />
      </div>

      <DesempenoOperadores operadores={operadores} isLoading={isLoading} />

      <Card className="rounded-2xl shadow-sm border-0 bg-card">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
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
              <p className="text-xl font-bold text-kpi-info">{creadasEsteMes}</p>
            </div>
            <div className="rounded-xl bg-kpi-success-soft p-3 text-center">
              <p className="text-xs text-kpi-success font-medium">Llegadas este mes</p>
              <p className="text-xl font-bold text-kpi-success">{llegadasEsteMes}</p>
            </div>
            <div className="rounded-xl bg-kpi-accent p-3 text-center">
              <p className="text-xs text-white/80 font-medium">Activas hoy</p>
              <p className="text-xl font-bold text-white">{global.activasHoy}</p>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="creadas" name="Por ETD" stroke="hsl(var(--kpi-info))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--kpi-info))" }} />
                <Line type="monotone" dataKey="llegadas" name="Llegadas" stroke="hsl(var(--kpi-success))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--kpi-success))" }} />
              </LineChart>
            </ResponsiveContainer>
          )}

          <Separator className="my-4" />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Balance ETD/llegadas</span>
            <Progress value={Math.min(balancePct, 100)} className={`h-2 flex-1 ${balancePct >= 100 ? "[&>div]:bg-success" : "[&>div]:bg-warning"}`} />
            <span className="text-xs font-medium">{balancePct}%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
