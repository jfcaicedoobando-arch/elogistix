import { Ship, Clock, FileText, DollarSign, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { embarques, facturas, formatDate, getEstadoColor, getModoIcon, formatCurrency } from "@/data/mockData";
import { useNavigate } from "react-router-dom";

const embarquesActivos = embarques.filter(e => !['Cerrado', 'Cotización'].includes(e.estado)).length;
const embarquesPorCerrar = embarques.filter(e => {
  if (e.estado === 'Cerrado') return false;
  const eta = new Date(e.eta);
  const now = new Date();
  const diff = (eta.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff <= 7 && diff >= -3;
}).length;
const facturasPendientes = facturas.filter(f => ['Emitida', 'Borrador'].includes(f.estado)).length;
const gastosPendientes = embarques.reduce((acc, e) => acc + e.conceptosCosto.filter(c => c.estadoLiquidacion === 'Pendiente').length, 0);

const chartData = [
  { mes: 'Sep', Marítimo: 5, Aéreo: 3, Terrestre: 2 },
  { mes: 'Oct', Marítimo: 7, Aéreo: 2, Terrestre: 4 },
  { mes: 'Nov', Marítimo: 4, Aéreo: 5, Terrestre: 3 },
  { mes: 'Dic', Marítimo: 6, Aéreo: 3, Terrestre: 2 },
  { mes: 'Ene', Marítimo: 8, Aéreo: 4, Terrestre: 3 },
  { mes: 'Feb', Marítimo: 5, Aéreo: 4, Terrestre: 4 },
];

const alertas = [
  { tipo: 'documento', mensaje: 'Certificado de Origen pendiente - EXP-2025-001', expediente: 'E001' },
  { tipo: 'fecha', mensaje: 'ETA mañana - EXP-2025-003 (Aéreo ICN→MEX)', expediente: 'E003' },
  { tipo: 'fecha', mensaje: 'Free days por vencer - EXP-2025-004 (Manzanillo)', expediente: 'E004' },
  { tipo: 'documento', mensaje: 'BL pendiente de validación - EXP-2025-002', expediente: 'E002' },
  { tipo: 'liquidacion', mensaje: '3 gastos por liquidar esta semana', expediente: '' },
];

const kpis = [
  { title: 'Embarques Activos', value: embarquesActivos, icon: Ship, color: 'text-accent' },
  { title: 'Por Cerrar esta Semana', value: embarquesPorCerrar, icon: Clock, color: 'text-warning' },
  { title: 'Facturas Pendientes', value: facturasPendientes, icon: FileText, color: 'text-info' },
  { title: 'Gastos por Liquidar', value: gastosPendientes, icon: DollarSign, color: 'text-destructive' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const recientes = [...embarques]
    .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())
    .slice(0, 8);

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
                  <p className="text-3xl font-bold mt-1">{kpi.value}</p>
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
              {alertas.map((alerta, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border p-3 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => alerta.expediente && navigate(`/embarques/${alerta.expediente}`)}
                >
                  <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                    alerta.tipo === 'documento' ? 'bg-warning' : alerta.tipo === 'fecha' ? 'bg-destructive' : 'bg-info'
                  }`} />
                  <span className="text-muted-foreground">{alerta.mensaje}</span>
                </div>
              ))}
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
                const origen = e.puertoOrigen || e.aeropuertoOrigen || e.ciudadOrigen || '-';
                const destino = e.puertoDestino || e.aeropuertoDestino || e.ciudadDestino || '-';
                return (
                  <TableRow
                    key={e.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/embarques/${e.id}`)}
                  >
                    <TableCell className="font-medium">{e.expediente}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{e.clienteNombre}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <span>{getModoIcon(e.modo)}</span>
                        <span className="text-xs">{e.modo}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {origen.split(',')[0]} → {destino.split(',')[0]}
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(e.etd)}</TableCell>
                    <TableCell className="text-xs">{formatDate(e.eta)}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
