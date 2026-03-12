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
  Activity, TrendingUp, AlertTriangle, Package, ChevronDown, Star, Users,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LabelList,
} from "recharts";
import { useOperacionesData, type PeriodoFiltro } from "@/hooks/useOperacionesData";
import { formatCurrency } from "@/lib/formatters";

// ─── KPI Card ────────────────────────────────────────────
function KpiCard({
  titulo, valor, icono: Icono, color, loading,
}: {
  titulo: string;
  valor: string | number;
  icono: React.ElementType;
  color: string;
  loading?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
    emerald: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <Card className="rounded-2xl shadow-sm border-0 bg-card">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`rounded-xl p-3 ${colorMap[color] ?? colorMap.blue}`}>
          <Icono className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{titulo}</p>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-foreground">{valor}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Mini bar chart for expandable rows ──────────────────
function MiniBarChart({ data }: { data: { mes: string; valor: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}>
        <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
          <LabelList dataKey="valor" position="top" className="text-[10px] fill-muted-foreground" />
        </Bar>
        <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Page ────────────────────────────────────────────────
export default function Operaciones() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("mes");
  const [operadorChart, setOperadorChart] = useState<string>("todos");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const { isLoading, operadores, global } = useOperacionesData(periodo);

  const hoyStr = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Max profit for relative bar
  const maxProfit = useMemo(
    () => Math.max(...operadores.map((o) => Math.abs(o.profit)), 1),
    [operadores]
  );

  // Chart data filtered by operador
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

  const topOperador = operadores.length > 0 ? operadores[0] : null;

  const balancePct = creadasEsteMes > 0
    ? Math.round((llegadasEsteMes / creadasEsteMes) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* BLOQUE 1 — Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard de Operaciones</h1>
          <p className="text-sm text-muted-foreground capitalize">{hoyStr}</p>
        </div>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoFiltro)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Este mes</SelectItem>
            <SelectItem value="3meses">Últimos 3 meses</SelectItem>
            <SelectItem value="anio">Este año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* BLOQUE 2 — KPIs globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard titulo="Cargas activas" valor={global.totalActivas} icono={Package} color="blue" loading={isLoading} />
        <KpiCard titulo="ETD este mes" valor={global.totalEsteMes} icono={Activity} color="violet" loading={isLoading} />
        <KpiCard titulo="Profit total USD" valor={formatCurrency(global.totalProfit, "USD")} icono={TrendingUp} color="emerald" loading={isLoading} />
        <KpiCard titulo="Demoras activas" valor={global.totalDemoras} icono={AlertTriangle} color="red" loading={isLoading} />
      </div>

      {/* BLOQUE 3 — Ranking */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Tabla ranking */}
        <Card className="xl:col-span-3 rounded-2xl shadow-sm border-0 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Ranking de Operadores
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : operadores.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Sin datos de operadores</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead className="text-center">Activas</TableHead>
                    <TableHead className="text-center">Este mes</TableHead>
                    <TableHead className="text-center">Clientes</TableHead>
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
                              {idx === 0 ? (
                                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                              ) : (
                                idx + 1
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{op.nombre}</TableCell>
                            <TableCell className="text-center">{op.cargasActivas}</TableCell>
                            <TableCell className="text-center">{op.cargasEsteMes}</TableCell>
                            <TableCell className="text-center">{op.clientes.length}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={op.demoras > 0 ? "destructive" : "secondary"} className={op.demoras === 0 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}>
                                {op.demoras}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-sm font-medium">{formatCurrency(op.profit, "USD")}</span>
                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full"
                                    style={{ width: `${Math.max((op.profit / maxProfit) * 100, 0)}%` }}
                                  />
                                </div>
                                <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${expandedRow === op.nombre ? "rotate-180" : ""}`} />
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <tr>
                            <td colSpan={7} className="p-4 bg-muted/30">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">Clientes activos</p>
                                  <div className="flex flex-wrap gap-1">
                                    {op.clientes.length > 0 ? op.clientes.map((c) => (
                                      <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                                    )) : (
                                      <span className="text-xs text-muted-foreground">Sin clientes</span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">Cargas creadas (6 meses)</p>
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

        {/* Top del mes */}
        <Card className="rounded-2xl shadow-sm border-0 bg-slate-900 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Top del mes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6 gap-3">
            {isLoading ? (
              <Skeleton className="h-20 w-20 rounded-full bg-slate-700" />
            ) : topOperador ? (
              <>
                <div className="rounded-full bg-amber-500/20 p-4">
                  <Star className="h-8 w-8 text-amber-400 fill-amber-400" />
                </div>
                <p className="text-lg font-bold">{topOperador.nombre}</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {formatCurrency(topOperador.profit, "USD")}
                </p>
                <p className="text-xs text-slate-400">
                  {topOperador.cargasActivas} activas · {topOperador.clientes.length} clientes
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">Sin datos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* BLOQUE 4 — Tendencia de cargas */}
      <Card className="rounded-2xl shadow-sm border-0 bg-card">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base font-semibold">Tendencia de cargas</CardTitle>
            <Select value={operadorChart} onValueChange={setOperadorChart}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos los operadores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los operadores</SelectItem>
                {operadores.map((op) => (
                  <SelectItem key={op.nombre} value={op.nombre}>{op.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {/* KPIs arriba de gráfica */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-blue-50 p-3 text-center">
              <p className="text-xs text-blue-600 font-medium">Creadas este mes</p>
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
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="creadas"
                  name="Creadas"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#3b82f6" }}
                >
                  <LabelList dataKey="creadas" position="top" className="text-xs fill-blue-600" />
                </Line>
                <Line
                  type="monotone"
                  dataKey="llegadas"
                  name="Llegadas"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#10b981" }}
                >
                  <LabelList dataKey="llegadas" position="bottom" className="text-xs fill-emerald-600" />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Barra de balance */}
          <Separator className="my-4" />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Balance creadas/llegadas</span>
            <Progress
              value={Math.min(balancePct, 100)}
              className={`h-2 flex-1 ${balancePct >= 100 ? "[&>div]:bg-emerald-500" : "[&>div]:bg-amber-500"}`}
            />
            <span className="text-xs font-medium">{balancePct}%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
