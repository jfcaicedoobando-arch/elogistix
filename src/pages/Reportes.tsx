import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmbarques } from "@/hooks/useEmbarques";
import { useFacturas, useGastosPendientes } from "@/hooks/useFacturas";
import { useClientes } from "@/hooks/useClientes";
import { formatCurrency } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const COLORS = ['hsl(217, 91%, 60%)', 'hsl(38, 92%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(0, 84%, 60%)'];

// Hook to get all conceptos_venta and conceptos_costo for reporting
function useAllConceptos() {
  return useQuery({
    queryKey: ['reportes', 'conceptos'],
    queryFn: async () => {
      const [ventaRes, costoRes] = await Promise.all([
        supabase.from('conceptos_venta').select('*'),
        supabase.from('conceptos_costo').select('*'),
      ]);
      if (ventaRes.error) throw ventaRes.error;
      if (costoRes.error) throw costoRes.error;
      return { ventas: ventaRes.data, costos: costoRes.data };
    },
  });
}

export default function Reportes() {
  const { data: embarques = [], isLoading: le } = useEmbarques();
  const { data: clientes = [] } = useClientes();
  const { data: facturas = [] } = useFacturas();
  const { data: gastosPendientes = [] } = useGastosPendientes();
  const { data: conceptos, isLoading: lc } = useAllConceptos();

  const loading = le || lc;

  const porModo = useMemo(() => [
    { name: 'Marítimo', value: embarques.filter(e => e.modo === 'Marítimo').length },
    { name: 'Aéreo', value: embarques.filter(e => e.modo === 'Aéreo').length },
    { name: 'Terrestre', value: embarques.filter(e => e.modo === 'Terrestre').length },
  ], [embarques]);

  const rentabilidadClientes = useMemo(() => {
    if (!conceptos) return [];
    return clientes.map(c => {
      const cEmbarques = embarques.filter(e => e.cliente_id === c.id);
      const embIds = new Set(cEmbarques.map(e => e.id));
      let totalVenta = 0, totalCosto = 0;
      // Map embarque id -> tipo cambio
      const tcMap = new Map(cEmbarques.map(e => [e.id, { usd: e.tipo_cambio_usd, eur: e.tipo_cambio_eur }]));
      conceptos.ventas.filter(v => embIds.has(v.embarque_id)).forEach(v => {
        const tc = tcMap.get(v.embarque_id);
        totalVenta += v.moneda === 'USD' ? v.total * (tc?.usd || 17.5) : v.moneda === 'EUR' ? v.total * (tc?.eur || 19) : v.total;
      });
      conceptos.costos.filter(g => embIds.has(g.embarque_id)).forEach(g => {
        const tc = tcMap.get(g.embarque_id);
        totalCosto += g.moneda === 'USD' ? g.monto * (tc?.usd || 17.5) : g.moneda === 'EUR' ? g.monto * (tc?.eur || 19) : g.monto;
      });
      return { nombre: c.nombre.split(' ').slice(0, 3).join(' '), embarques: cEmbarques.length, venta: totalVenta, costo: totalCosto, utilidad: totalVenta - totalCosto };
    }).filter(c => c.embarques > 0).sort((a, b) => b.utilidad - a.utilidad);
  }, [clientes, embarques, conceptos]);

  const totalPorCobrar = useMemo(() =>
    facturas.filter(f => ['Emitida', 'Vencida'].includes(f.estado)).reduce((sum, f) => sum + f.total, 0),
    [facturas]
  );

  const totalPorPagar = useMemo(() =>
    gastosPendientes.reduce((sum, g) => sum + g.monto, 0),
    [gastosPendientes]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Embarques</p>{loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{embarques.length}</p>}</CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cuentas por Cobrar</p>{loading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold text-warning">{formatCurrency(totalPorCobrar)}</p>}</CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cuentas por Pagar</p>{loading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold text-destructive">{formatCurrency(totalPorPagar)}</p>}</CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Embarques por Modo</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[250px] w-full" /> : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={porModo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                    {porModo.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Rentabilidad por Cliente (MXN)</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[250px] w-full" /> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={rentabilidadClientes} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="nombre" width={120} className="text-xs" />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="utilidad" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Clientes */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Top Clientes por Volumen e Ingresos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
