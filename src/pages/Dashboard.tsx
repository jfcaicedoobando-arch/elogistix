import { Ship, Clock, FileText, DollarSign, AlertTriangle, Activity } from "lucide-react";
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
import { useActividadReciente } from "@/hooks/useBitacora";
import { BitacoraActividad } from "@/components/BitacoraActividad";
import { usePermissions } from "@/hooks/usePermissions";
import { formatCurrency } from "@/lib/formatters";
import { formatDate, getEstadoColor, getModoIcon } from "@/lib/helpers";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const { data: embarques = [], isLoading: cargandoEmbarques } = useEmbarques();
  const { data: facturas = [], isLoading: cargandoFacturas } = useFacturas();
  const { data: gastosPendientes = [] } = useGastosPendientes();
  const { data: actividadReciente = [], isLoading: cargandoActividad } = useActividadReciente(10);

  const stats = useMemo(() => {
    const embarquesActivos = embarques.filter(embarque => !['Cerrado', 'Cotización'].includes(embarque.estado)).length;
    const embarquesPorCerrar = embarques.filter(embarque => {
      if (embarque.estado === 'Cerrado' || !embarque.eta) return false;
      const eta = new Date(embarque.eta);
      const now = new Date();
      const diasParaLlegada = (eta.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diasParaLlegada <= 7 && diasParaLlegada >= -3;
    }).length;
    const facturasPendientes = facturas.filter(factura => ['Emitida', 'Borrador'].includes(factura.estado)).length;
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
      const fechaMes = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = fechaMes.toLocaleDateString('es-MX', { month: 'short' });
      const anio = fechaMes.getFullYear(), mes = fechaMes.getMonth();
      const embarquesDelMes = embarques.filter(embarque => {
        const fechaCreacion = new Date(embarque.created_at);
        return fechaCreacion.getFullYear() === anio && fechaCreacion.getMonth() === mes;
      });
      months.push({
        mes: label.charAt(0).toUpperCase() + label.slice(1),
        Marítimo: embarquesDelMes.filter(embarque => embarque.modo === 'Marítimo').length,
        Aéreo: embarquesDelMes.filter(embarque => embarque.modo === 'Aéreo').length,
        Terrestre: embarquesDelMes.filter(embarque => embarque.modo === 'Terrestre').length,
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

  const loading = cargandoEmbarques || cargandoFacturas;

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

        {/* Alertas */}
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
              {embarques.filter(embarque => embarque.eta && !['Cerrado'].includes(embarque.estado)).filter(embarque => {
                const diasParaLlegada = (new Date(embarque.eta!).getTime() - Date.now()) / 864e5;
                return diasParaLlegada <= 3 && diasParaLlegada >= -1;
              }).slice(0, 4).map(embarque => (
                <div key={embarque.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/embarques/${embarque.id}`)}>
                  <div className="mt-0.5 h-2 w-2 rounded-full shrink-0 bg-destructive" />
                  <span className="text-muted-foreground">ETA próxima - {embarque.expediente} ({embarque.modo})</span>
                </div>
              ))}
              {facturas.filter(factura => factura.estado === 'Vencida').slice(0, 3).map(factura => (
                <div key={factura.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/facturacion')}>
                  <div className="mt-0.5 h-2 w-2 rounded-full shrink-0 bg-warning" />
                  <span className="text-muted-foreground">Factura vencida - {factura.numero}</span>
                </div>
              ))}
              {embarques.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground text-center py-4">Sin alertas</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actividad Reciente */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            Actividad Reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cargandoActividad ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, indice) => (
                <Skeleton key={indice} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <BitacoraActividad actividades={actividadReciente} mostrarUsuario={isAdmin} />
          )}
        </CardContent>
      </Card>

      {/* Embarques recientes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Embarques Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, indice) => <Skeleton key={indice} className="h-10 w-full" />)}</div>
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
                {recientes.map((embarque) => {
                  const origen = embarque.puerto_origen || embarque.aeropuerto_origen || embarque.ciudad_origen || '-';
                  const destino = embarque.puerto_destino || embarque.aeropuerto_destino || embarque.ciudad_destino || '-';
                  return (
                    <TableRow key={embarque.id} className="cursor-pointer" onClick={() => navigate(`/embarques/${embarque.id}`)}>
                      <TableCell className="font-medium">{embarque.expediente}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{embarque.cliente_nombre}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <span>{getModoIcon(embarque.modo)}</span>
                          <span className="text-xs">{embarque.modo}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {origen.split(',')[0]} → {destino.split(',')[0]}
                      </TableCell>
                      <TableCell className="text-xs">{embarque.etd ? formatDate(embarque.etd) : '-'}</TableCell>
                      <TableCell className="text-xs">{embarque.eta ? formatDate(embarque.eta) : '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-xs ${getEstadoColor(embarque.estado)}`}>
                          {embarque.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{embarque.operador}</TableCell>
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
