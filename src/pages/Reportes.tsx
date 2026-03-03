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
  const { data: embarques = [], isLoading: cargandoEmbarques } = useEmbarques();
  const { data: clientes = [] } = useClientes();
  const { data: facturas = [] } = useFacturas();
  const { data: gastosPendientes = [] } = useGastosPendientes();
  const { data: conceptos, isLoading: cargandoConceptos } = useAllConceptos();

  const loading = cargandoEmbarques || cargandoConceptos;

  const porModo = useMemo(() => [
    { name: 'Marítimo', value: embarques.filter(embarque => embarque.modo === 'Marítimo').length },
    { name: 'Aéreo', value: embarques.filter(embarque => embarque.modo === 'Aéreo').length },
    { name: 'Terrestre', value: embarques.filter(embarque => embarque.modo === 'Terrestre').length },
  ], [embarques]);

  const rentabilidadClientes = useMemo(() => {
    if (!conceptos) return [];
    return clientes.map(cliente => {
      const embarquesDelCliente = embarques.filter(embarque => embarque.cliente_id === cliente.id);
      const idsEmbarquesCliente = new Set(embarquesDelCliente.map(embarque => embarque.id));
      let totalVenta = 0, totalCosto = 0;
      const tiposCambioEmbarques = new Map(embarquesDelCliente.map(embarque => [embarque.id, { usd: embarque.tipo_cambio_usd, eur: embarque.tipo_cambio_eur }]));
      conceptos.ventas.filter(venta => idsEmbarquesCliente.has(venta.embarque_id)).forEach(venta => {
        const tipoCambio = tiposCambioEmbarques.get(venta.embarque_id);
        totalVenta += venta.moneda === 'USD' ? venta.total * (tipoCambio?.usd || 17.5) : venta.moneda === 'EUR' ? venta.total * (tipoCambio?.eur || 19) : venta.total;
      });
      conceptos.costos.filter(costo => idsEmbarquesCliente.has(costo.embarque_id)).forEach(costo => {
        const tipoCambio = tiposCambioEmbarques.get(costo.embarque_id);
        totalCosto += costo.moneda === 'USD' ? costo.monto * (tipoCambio?.usd || 17.5) : costo.moneda === 'EUR' ? costo.monto * (tipoCambio?.eur || 19) : costo.monto;
      });
      return { nombre: cliente.nombre.split(' ').slice(0, 3).join(' '), embarques: embarquesDelCliente.length, venta: totalVenta, costo: totalCosto, utilidad: totalVenta - totalCosto };
    }).filter(cliente => cliente.embarques > 0).sort((a, b) => b.utilidad - a.utilidad);
  }, [clientes, embarques, conceptos]);

  const totalPorCobrar = useMemo(() =>
    facturas.filter(factura => ['Emitida', 'Vencida'].includes(factura.estado)).reduce((sum, factura) => sum + factura.total, 0),
    [facturas]
  );

  const totalPorPagar = useMemo(() =>
    gastosPendientes.reduce((sum, gasto) => sum + gasto.monto, 0),
    [gastosPendientes]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-sm text-muted-foreground">Análisis de rendimiento y rentabilidad</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-accent"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Embarques</p>{loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold mt-1">{embarques.length}</p>}</CardContent></Card>
        <Card className="border-l-4 border-l-warning"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cuentas por Cobrar</p>{loading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold text-warning mt-1">{formatCurrency(totalPorCobrar)}</p>}</CardContent></Card>
        <Card className="border-l-4 border-l-destructive"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cuentas por Pagar</p>{loading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold text-destructive mt-1">{formatCurrency(totalPorPagar)}</p>}</CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Embarques por Modo</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[250px] w-full" /> : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={porModo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                    {porModo.map((_, indice) => <Cell key={indice} fill={COLORS[indice]} />)}
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
                  <XAxis type="number" tickFormatter={(valor) => `$${(valor / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="nombre" width={120} className="text-xs" />
                  <Tooltip formatter={(valor: number) => formatCurrency(valor)} />
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
            <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, indice) => <Skeleton key={indice} className="h-10 w-full" />)}</div>
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
                {rentabilidadClientes.map((cliente, indice) => (
                  <TableRow key={indice}>
                    <TableCell className="font-medium">{cliente.nombre}</TableCell>
                    <TableCell>{cliente.embarques}</TableCell>
                    <TableCell>{formatCurrency(cliente.venta)}</TableCell>
                    <TableCell>{formatCurrency(cliente.costo)}</TableCell>
                    <TableCell className={cliente.utilidad >= 0 ? 'text-success font-medium' : 'text-destructive font-medium'}>{formatCurrency(cliente.utilidad)}</TableCell>
                    <TableCell>{cliente.venta > 0 ? ((cliente.utilidad / cliente.venta) * 100).toFixed(1) : 0}%</TableCell>
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
