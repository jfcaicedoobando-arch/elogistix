import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, AlertTriangle, Package, ChevronDown, Star, Users,
  Container, Shield, Anchor, Ship,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  useOperacionesData, MAX_CONTENEDORES,
  type PeriodoFiltro,
} from "@/hooks/useOperacionesData";
import { formatCurrency } from "@/lib/formatters";
import { useNavigate } from "react-router-dom";
import { KpiCard } from "@/components/operaciones/KpiCard";
import {
  RiesgoIndicador, CapacityBar, RiskBadge, MiniBarChart, RiskDetailTable,
} from "@/components/operaciones/OperacionesWidgets";

export default function Operaciones() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("mes");
  const [operadorChart, setOperadorChart] = useState<string>("todos");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const { isLoading, operadores, global } = useOperacionesData(periodo);
  const navigate = useNavigate();

  const hoyStr = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const maxProfit = useMemo(
    () => Math.max(...operadores.map((o) => Math.abs(o.profit)), 1),
    [operadores]
  );

  const chartData = useMemo(() => {
    if (operadorChart === "todos") return global.historicoCreadosPorMes;
    const op = operadores.find((o) => o.nombre === operadorChart);
    if (!op) return global.historicoCreadosPorMes;
    return op.historicoCreadosPorMes.map((c, i) => ({
      mes: c.mes,
      creadas: c.valor,
      llegadas: op.historicoLlegadosPorMes[i]?.valor || 0,
    }));
  }, [operadorChart, operadores, global]);

  const creadasEsteMes = operadorChart === "todos"
    ? global.creadasEsteMes
    : operadores.find((o) => o.nombre === operadorChart)?.cargasEsteMes ?? 0;

  const llegadasEsteMes = operadorChart === "todos"
    ? global.llegadasEsteMes
    : (() => {
        const op = operadores.find((o) => o.nombre === operadorChart);
        if (!op) return 0;
        const last = op.historicoLlegadosPorMes[op.historicoLlegadosPorMes.length - 1];
        return last?.valor || 0;
      })();

  const balancePct = creadasEsteMes > 0
    ? Math.round((llegadasEsteMes / creadasEsteMes) * 100)
    : 100;

  const contPct = global.totalContenedores > 0
    ? Math.round((global.totalContenedores / MAX_CONTENEDORES) * 100)
    : 0;

  const totalAlertas = global.totalCriticos + global.totalEnPuerto;

  return (
    <div className="space-y-6">
      {/* ── HEADER ───────────────────────────────────── */}
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

      {/* ── KPIs globales ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard titulo="Cargas activas" valor={global.totalActivas} icono={Package} color="blue" loading={isLoading} />
        <KpiCard titulo="Contenedores" valor={`${global.totalContenedores} / ${MAX_CONTENEDORES}`} icono={Container} color="violet" loading={isLoading}>
          {!isLoading && <Progress value={contPct} className="h-1.5 mt-1.5 [&>div]:bg-violet-500" />}
        </KpiCard>
        <KpiCard titulo="Profit total USD" valor={formatCurrency(global.totalProfit, "USD")} icono={TrendingUp} color="emerald" loading={isLoading} />
        <KpiCard titulo="Alertas de riesgo" valor={totalAlertas} subtitulo={totalAlertas > 0 ? `${global.totalCriticos} críticos · ${global.totalEnPuerto} en puerto` : "Sin alertas"} icono={AlertTriangle} color="red" loading={isLoading} />
      </div>

      {/* ── Ranking de Operadores ─────────────────────── */}
      <Card className="rounded-2xl shadow-sm border-0 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Ranking de Operadores
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : operadores.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Sin datos de operadores</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead className="text-center">Estado de cargas</TableHead>
                  <TableHead className="text-center">Contenedores</TableHead>
                  <TableHead className="text-center">Activas</TableHead>
                  <TableHead className="text-center">Demoras</TableHead>
                  <TableHead className="text-right">Profit USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operadores.map((op, idx) => (
                  <Collapsible key={op.nombre} open={expandedRow === op.nombre} onOpenChange={(open) => setExpandedRow(open ? op.nombre : null)} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer">
                          <TableCell className="font-medium">
                            {idx === 0 ? <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> : idx + 1}
                          </TableCell>
                          <TableCell className="font-medium">{op.nombre}</TableCell>
                          <TableCell className="text-center">
                            <RiesgoIndicador criticos={op.criticos} enPuerto={op.enPuerto} porArribar={op.porArribar} />
                          </TableCell>
                          <TableCell className="text-center">
                            <CapacityBar count={op.contenedores} max={MAX_CONTENEDORES} />
                          </TableCell>
                          <TableCell className="text-center">{op.cargasActivas}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={op.demoras > 0 ? "destructive" : "secondary"} className={op.demoras === 0 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}>
                              {op.demoras}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-sm font-medium">{formatCurrency(op.profit, "USD")}</span>
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max((op.profit / maxProfit) * 100, 0)}%` }} />
                              </div>
                              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${expandedRow === op.nombre ? "rotate-180" : ""}`} />
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={7} className="p-4 bg-muted/30">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-2">Clientes activos</p>
                                <div className="flex flex-wrap gap-1">
                                  {op.clientes.length > 0 ? op.clientes.map((c) => (
                                    <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                                  )) : <span className="text-xs text-muted-foreground">Sin clientes</span>}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-2">Cargas en riesgo</p>
                                <RiskDetailTable cargas={op.cargasEnRiesgo} />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-2">Cargas por ETD (6 meses)</p>
                                <MiniBarChart data={op.historicoCreadosPorMes} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Cargas en riesgo ──────────────────────────── */}
      <Card className="rounded-2xl shadow-sm border-0 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-red-500" />
            Cargas en riesgo
            {global.cargasEnRiesgo.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px]">{global.cargasEnRiesgo.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : global.cargasEnRiesgo.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Anchor className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Sin cargas en riesgo</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Expediente</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead className="text-center">Días</TableHead>
                    <TableHead>ETA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {global.cargasEnRiesgo.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/embarques/${c.id}`)}>
                      <TableCell className="font-mono text-xs font-medium">{c.expediente}</TableCell>
                      <TableCell className="text-xs">{c.cliente_nombre}</TableCell>
                      <TableCell className="text-xs">{c.operador}</TableCell>
                      <TableCell className="text-xs">{c.estadoReal}</TableCell>
                      <TableCell><RiskBadge nivel={c.nivelRiesgo} /></TableCell>
                      <TableCell className="text-center text-xs font-bold">
                        {c.nivelRiesgo === "critico" ? (
                          <span className="text-red-600">{c.diasEnPuerto}d</span>
                        ) : c.diasEnPuerto > 0 ? (
                          <span className="text-amber-600">{c.diasEnPuerto}d</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.eta ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tendencia de cargas ────────────────────────── */}
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
            <div className="rounded-xl bg-blue-50 p-3 text-center">
              <p className="text-xs text-blue-600 font-medium">ETD este mes</p>
              <p className="text-xl font-bold text-blue-700">{creadasEsteMes}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <p className="text-xs text-emerald-600 font-medium">Llegadas este mes</p>
              <p className="text-xl font-bold text-emerald-700">{llegadasEsteMes}</p>
            </div>
            <div className="rounded-xl bg-violet-600 p-3 text-center">
              <p className="text-xs text-violet-100 font-medium">Activas hoy</p>
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
                <Line type="monotone" dataKey="creadas" name="Por ETD" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: "#3b82f6" }} />
                <Line type="monotone" dataKey="llegadas" name="Llegadas" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: "#10b981" }} />
              </LineChart>
            </ResponsiveContainer>
          )}

          <Separator className="my-4" />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Balance ETD/llegadas</span>
            <Progress value={Math.min(balancePct, 100)} className={`h-2 flex-1 ${balancePct >= 100 ? "[&>div]:bg-emerald-500" : "[&>div]:bg-amber-500"}`} />
            <span className="text-xs font-medium">{balancePct}%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
