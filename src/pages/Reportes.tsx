import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { embarques, clientes, facturas, formatCurrency } from "@/data/mockData";

const COLORS = ['hsl(217, 91%, 60%)', 'hsl(38, 92%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(0, 84%, 60%)'];

// Embarques por modo
const porModo = [
  { name: 'Marítimo', value: embarques.filter(e => e.modo === 'Marítimo').length },
  { name: 'Aéreo', value: embarques.filter(e => e.modo === 'Aéreo').length },
  { name: 'Terrestre', value: embarques.filter(e => e.modo === 'Terrestre').length },
];

// Rentabilidad por cliente
const rentabilidadClientes = clientes.map(c => {
  const cEmbarques = embarques.filter(e => e.clienteId === c.id);
  let totalVenta = 0, totalCosto = 0;
  cEmbarques.forEach(e => {
    e.conceptosVenta.forEach(v => {
      totalVenta += v.moneda === 'USD' ? v.total * e.tipoCambioUSD : v.moneda === 'EUR' ? v.total * e.tipoCambioEUR : v.total;
    });
    e.conceptosCosto.forEach(g => {
      totalCosto += g.moneda === 'USD' ? g.monto * e.tipoCambioUSD : g.moneda === 'EUR' ? g.monto * e.tipoCambioEUR : g.monto;
    });
  });
  return { nombre: c.nombre.split(' ').slice(0, 3).join(' '), embarques: cEmbarques.length, venta: totalVenta, costo: totalCosto, utilidad: totalVenta - totalCosto };
}).filter(c => c.embarques > 0).sort((a, b) => b.utilidad - a.utilidad);

// Cuentas por cobrar
const cuentasPorCobrar = facturas.filter(f => ['Emitida', 'Vencida'].includes(f.estado));
const totalPorCobrar = cuentasPorCobrar.reduce((sum, f) => sum + f.total, 0);

// Cuentas por pagar
const gastosPendientes = embarques.flatMap(e =>
  e.conceptosCosto.filter(c => c.estadoLiquidacion === 'Pendiente').map(c => ({
    ...c, expediente: e.expediente, tipoCambio: c.moneda === 'USD' ? e.tipoCambioUSD : c.moneda === 'EUR' ? e.tipoCambioEUR : 1
  }))
);
const totalPorPagar = gastosPendientes.reduce((sum, g) => sum + g.monto * g.tipoCambio, 0);

export default function Reportes() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Embarques</p><p className="text-2xl font-bold">{embarques.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cuentas por Cobrar</p><p className="text-2xl font-bold text-warning">{formatCurrency(totalPorCobrar)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cuentas por Pagar</p><p className="text-2xl font-bold text-destructive">{formatCurrency(totalPorPagar)}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Embarques por Modo</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={porModo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  {porModo.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Rentabilidad por Cliente (MXN)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={rentabilidadClientes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nombre" width={120} className="text-xs" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="utilidad" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Clientes */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Top Clientes por Volumen e Ingresos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Embarques</TableHead>
                <TableHead>Venta Total</TableHead>
                <TableHead>Costo Total</TableHead>
                <TableHead>Utilidad</TableHead>
                <TableHead>Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rentabilidadClientes.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell>{c.embarques}</TableCell>
                  <TableCell>{formatCurrency(c.venta)}</TableCell>
                  <TableCell>{formatCurrency(c.costo)}</TableCell>
                  <TableCell className={c.utilidad >= 0 ? 'text-success font-medium' : 'text-destructive font-medium'}>{formatCurrency(c.utilidad)}</TableCell>
                  <TableCell>{c.venta > 0 ? ((c.utilidad / c.venta) * 100).toFixed(1) : 0}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
