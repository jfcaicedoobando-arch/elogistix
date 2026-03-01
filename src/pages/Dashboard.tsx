import { Ship, Clock, FileText, DollarSign, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmbarques } from "@/hooks/useEmbarques";
import { useFacturas, useGastosPendientes } from "@/hooks/useFacturas";
import { formatCurrency } from "@/lib/formatters";
import { formatDate, getEstadoColor, getModoIcon } from "@/lib/helpers";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: embarques = [], isLoading: loadingEmbarques } = useEmbarques();
  const { data: facturas = [], isLoading: loadingFacturas } = useFacturas();
  const { data: gastosPendientes = [] } = useGastosPendientes();

  const stats = useMemo(() => {
    const embarquesActivos = embarques.filter(e => !['Cerrado', 'Cotización'].includes(e.estado)).length;
    const embarquesPorCerrar = embarques.filter(e => {
      if (e.estado === 'Cerrado' || !e.eta) return false;
      const eta = new Date(e.eta);
      const now = new Date();
      const diff = (eta.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7 && diff >= -3;
    }).length;
    const facturasPendientes = facturas.filter(f => ['Emitida', 'Borrador'].includes(f.estado)).length;
    return { embarquesActivos, embarquesPorCerrar, facturasPendientes, gastosPendientes: gastosPendientes.length };
  }, [embarques, facturas, gastosPendientes]);

  const recientes = useMemo(() =>
    [...embarques].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8),
    [embarques]
  );

  // Chart from real data: count by mode per month (last 6 months)
  const chartData = useMemo(() => {
    const now = new Date();
    const months: { mes: string; Marítimo: number; Aéreo: number; Terrestre: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('es-MX', { month: 'short' });
      const y = d.getFullYear(), m = d.getMonth();
      const inMonth = embarques.filter(e => {
        const c = new Date(e.created_at);
        return c.getFullYear() === y && c.getMonth() === m;
      });
      months.push({
        mes: label.charAt(0).toUpperCase() + label.slice(1),
        Marítimo: inMonth.filter(e => e.modo === 'Marítimo').length,
        Aéreo: inMonth.filter(e => e.modo === 'Aéreo').length,
        Terrestre: inMonth.filter(e => e.modo === 'Terrestre').length,
      });
    }
    return months;
  }, [embarques]);

  const kpis = [
    { title: 'Embarques Activos', value: stats.embarquesActivos, icon: Ship, color: 'text-accent' },
    { title: 'Por Cerrar esta Semana', value: stats.embarquesPorCerrar, icon: Clock, color: 'text-warning' },
    { title: 'Facturas Pendientes', value: stats.facturasPendientes, icon: FileText, color: 'text-info' },
    { title: 'Gastos por Liquidar', value: stats.gastosPendientes, icon: DollarSign, color: 'text-destructive' },
  ];

  const loading = loadingEmbarques || loadingFacturas;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen operativo del día</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.title}</p>
                  {loading ? <Skeleton className="h-9 w-16 mt-1" /> : <p className="text-3xl font-bold mt-1">{kpi.value}</p>}
                </div>
                <kpi.icon className={`h-8 w-8 ${kpi.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Embarques por Modo — Últimos 6 Meses</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[280px] w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Marítimo" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Aéreo" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Terrestre" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Alertas - now dynamic */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Alertas del Día
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {gastosPendientes.length > 0 && (
                <div className="flex items-start gap-3 rounded-lg border p-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/facturacion')}>
                  <div className="mt-0.5 h-2 w-2 rounded-full shrink-0 bg-info" />
                  <span className="text-muted-foreground">{gastosPendientes.length} gastos por liquidar</span>
                </div>
              )}
              {embarques.filter(e => e.eta && !['Cerrado'].includes(e.estado)).filter(e => {
                const diff = (new Date(e.eta!).getTime() - Date.now()) / 864e5;
                return diff <= 3 && diff >= -1;
              }).slice(0, 4).map(e => (
                <div key={e.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/embarques/${e.id}`)}>
                  <div className="mt-0.5 h-2 w-2 rounded-full shrink-0 bg-destructive" />
                  <span className="text-muted-foreground">ETA próxima - {e.expediente} ({e.modo})</span>
                </div>
              ))}
              {facturas.filter(f => f.estado === 'Vencida').slice(0, 3).map(f => (
                <div key={f.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/facturacion')}>
                  <div className="mt-0.5 h-2 w-2 rounded-full shrink-0 bg-warning" />
                  <span className="text-muted-foreground">Factura vencida - {f.numero}</span>
                </div>
              ))}
              {embarques.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground text-center py-4">Sin alertas</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Embarques recientes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Embarques Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expediente</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Origen → Destino</TableHead>
                  <TableHead>ETD</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Operador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recientes.map((e) => {
                  const origen = e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || '-';
                  const destino = e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || '-';
                  return (
                    <TableRow key={e.id} className="cursor-pointer" onClick={() => navigate(`/embarques/${e.id}`)}>
                      <TableCell className="font-medium">{e.expediente}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{e.cliente_nombre}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <span>{getModoIcon(e.modo)}</span>
                          <span className="text-xs">{e.modo}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {origen.split(',')[0]} → {destino.split(',')[0]}
                      </TableCell>
                      <TableCell className="text-xs">{e.etd ? formatDate(e.etd) : '-'}</TableCell>
                      <TableCell className="text-xs">{e.eta ? formatDate(e.eta) : '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-xs ${getEstadoColor(e.estado)}`}>
                          {e.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{e.operador}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
