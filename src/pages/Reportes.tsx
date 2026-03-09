import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmbarques } from "@/hooks/useEmbarques";
import { useClientes } from "@/hooks/useClientes";
import { formatCurrency } from "@/lib/formatters";
import { convertirAMXN, calcularUtilidad, calcularMargen } from "@/lib/financialUtils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { format, differenceInDays, subMonths, startOfMonth } from "date-fns";

const COLORS = ['hsl(217, 91%, 60%)', 'hsl(38, 92%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(0, 84%, 60%)', 'hsl(300, 84%, 60%)'];

// Hook to get all conceptos_venta and conceptos_costo for reporting
function useAllConceptos() {
  return useQuery({
    queryKey: queryKeys.reportes.conceptos,
    queryFn: async () => {
      const [ventaRes, costoRes] = await Promise.all([
        supabase.from('conceptos_venta').select('embarque_id, total, moneda'),
        supabase.from('conceptos_costo').select('embarque_id, monto, moneda'),
      ]);
      if (ventaRes.error) throw ventaRes.error;
      if (costoRes.error) throw costoRes.error;
      return { ventas: ventaRes.data, costos: costoRes.data };
    },
  });
}

// Hook to get all cotizaciones for sales metrics
function useAllCotizaciones() {
  return useQuery({
    queryKey: queryKeys.reportes.cotizaciones,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotizaciones')
        .select('id, folio, estado, operador, modo, created_at');
      if (error) throw error;
      return data;
    },
  });
}

// Helper function to get start date for period filtering
function getFechaInicio(periodo: 'mes' | 'trimestre' | 'año'): Date {
  const hoy = new Date();
  if (periodo === 'mes') return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  if (periodo === 'trimestre') return new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
  return new Date(hoy.getFullYear(), 0, 1);
}

export default function Reportes() {
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<'mes' | 'trimestre' | 'año'>('mes');
  
  const { data: embarques = [], isLoading: cargandoEmbarques } = useEmbarques();
  const { data: clientes = [] } = useClientes();
  const { data: conceptos, isLoading: cargandoConceptos } = useAllConceptos();
  const { data: cotizaciones = [], isLoading: cargandoCotizaciones } = useAllCotizaciones();

  const loading = cargandoEmbarques || cargandoConceptos || cargandoCotizaciones;
  const fechaInicio = getFechaInicio(periodoSeleccionado);
  const hoy = new Date();

  // Filter data by selected period
  const embarquesFiltrados = useMemo(() => 
    embarques.filter(embarque => new Date(embarque.created_at) >= fechaInicio),
    [embarques, fechaInicio]
  );

  const cotizacionesFiltradas = useMemo(() =>
    cotizaciones.filter(cotizacion => new Date(cotizacion.created_at) >= fechaInicio),
    [cotizaciones, fechaInicio]
  );

  // KPI Calculations
  const embarquesActivos = useMemo(() =>
    embarquesFiltrados.filter(embarque => !['EIR', 'Cerrado', 'Cancelado'].includes(embarque.estado)).length,
    [embarquesFiltrados]
  );

  const profitTotalUSD = useMemo(() => {
    if (!conceptos) return 0;
    const embarqueIds = new Set(embarquesFiltrados.map(e => e.id));
    const ventasUSD = conceptos.ventas
      .filter(v => v.moneda === 'USD' && embarqueIds.has(v.embarque_id))
      .reduce((sum, v) => sum + v.total, 0);
    const costosUSD = conceptos.costos
      .filter(c => c.moneda === 'USD' && embarqueIds.has(c.embarque_id))
      .reduce((sum, c) => sum + c.monto, 0);
    return ventasUSD - costosUSD;
  }, [conceptos, embarquesFiltrados]);

  const cotizacionesCreadas = cotizacionesFiltradas.length;

  const tasaConversion = useMemo(() => {
    if (cotizacionesCreadas === 0) return 0;
    const aceptadas = cotizacionesFiltradas.filter(c => c.estado === 'Aceptada').length;
    return (aceptadas / cotizacionesCreadas) * 100;
  }, [cotizacionesFiltradas, cotizacionesCreadas]);

  // Operations data
  const embarquesPorEstado = useMemo(() => {
    const estados = embarquesFiltrados.reduce((acc, embarque) => {
      acc[embarque.estado] = (acc[embarque.estado] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(estados).map(([name, value]) => ({ name, value }));
  }, [embarquesFiltrados]);

  const embarquesPorModo = useMemo(() => [
    { name: 'Marítimo', value: embarquesFiltrados.filter(e => e.modo === 'Marítimo').length },
    { name: 'Aéreo', value: embarquesFiltrados.filter(e => e.modo === 'Aéreo').length },
    { name: 'Terrestre', value: embarquesFiltrados.filter(e => e.modo === 'Terrestre').length },
  ], [embarquesFiltrados]);

  const embarquesDemorados = useMemo(() => {
    return embarques
      .filter(embarque => 
        embarque.estado === 'Arribo' && 
        embarque.eta && 
        differenceInDays(hoy, new Date(embarque.eta)) > 7
      )
      .map(embarque => ({
        expediente: embarque.expediente,
        cliente: embarque.cliente_nombre,
        eta: embarque.eta,
        diasDemora: differenceInDays(hoy, new Date(embarque.eta!))
      }))
      .sort((a, b) => b.diasDemora - a.diasDemora)
      .slice(0, 5);
  }, [embarques, hoy]);

  // Sales data
  const cotizacionesPorMes = useMemo(() => {
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const fecha = subMonths(startOfMonth(hoy), i);
      const inicioMes = startOfMonth(fecha);
      const finMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0);
      
      const count = cotizaciones.filter(c => {
        const fechaCreacion = new Date(c.created_at);
        return fechaCreacion >= inicioMes && fechaCreacion <= finMes;
      }).length;
      
      meses.push({
        mes: format(fecha, 'MMM yyyy'),
        cotizaciones: count
      });
    }
    return meses;
  }, [cotizaciones, hoy]);

  const cotizacionesPorEstado = useMemo(() => {
    const estados = cotizacionesFiltradas.reduce((acc, cotizacion) => {
      acc[cotizacion.estado] = (acc[cotizacion.estado] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(estados).map(([estado, count]) => ({
      estado,
      count,
      porcentaje: cotizacionesCreadas > 0 ? (count / cotizacionesCreadas * 100).toFixed(1) : '0.0'
    }));
  }, [cotizacionesFiltradas, cotizacionesCreadas]);

  const topOperadores = useMemo(() => {
    const operadores = cotizacionesFiltradas
      .filter(c => c.estado === 'Aceptada')
      .reduce((acc, cotizacion) => {
        if (cotizacion.operador) {
          acc[cotizacion.operador] = (acc[cotizacion.operador] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
    
    return Object.entries(operadores)
      .map(([operador, count]) => ({ operador, cotizaciones: count }))
      .sort((a, b) => b.cotizaciones - a.cotizaciones)
      .slice(0, 5);
  }, [cotizacionesFiltradas]);

  // Profitability data
  const profitPorMes = useMemo(() => {
    if (!conceptos) return [];
    
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const fecha = subMonths(startOfMonth(hoy), i);
      const inicioMes = startOfMonth(fecha);
      const finMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0);
      
      const embarquesMes = embarques.filter(e => {
        const fechaCreacion = new Date(e.created_at);
        return fechaCreacion >= inicioMes && fechaCreacion <= finMes;
      });
      
      const idsEmbarquesMes = new Set(embarquesMes.map(e => e.id));
      
      const ventasUSD = conceptos.ventas
        .filter(v => v.moneda === 'USD' && idsEmbarquesMes.has(v.embarque_id))
        .reduce((sum, v) => sum + v.total, 0);
      const costosUSD = conceptos.costos
        .filter(c => c.moneda === 'USD' && idsEmbarquesMes.has(c.embarque_id))
        .reduce((sum, c) => sum + c.monto, 0);
      
      meses.push({
        mes: format(fecha, 'MMM yyyy'),
        profit: ventasUSD - costosUSD
      });
    }
    return meses;
  }, [conceptos, embarques, hoy]);

  const profitPorModo = useMemo(() => {
    if (!conceptos) return [];
    
    return ['Marítimo', 'Aéreo', 'Terrestre'].map(modo => {
      const embarquesModo = embarquesFiltrados.filter(e => e.modo === modo);
      const idsEmbarquesModo = new Set(embarquesModo.map(e => e.id));
      
      let totalVenta = 0, totalCosto = 0;
      const tiposCambioEmbarques = new Map(embarquesModo.map(e => [e.id, { usd: e.tipo_cambio_usd, eur: e.tipo_cambio_eur }]));
      
      conceptos.ventas.filter(v => idsEmbarquesModo.has(v.embarque_id)).forEach(v => {
        const tipoCambio = tiposCambioEmbarques.get(v.embarque_id);
        totalVenta += convertirAMXN(v.total, v.moneda, tipoCambio?.usd || 17.5, tipoCambio?.eur || 19);
      });
      
      conceptos.costos.filter(c => idsEmbarquesModo.has(c.embarque_id)).forEach(c => {
        const tipoCambio = tiposCambioEmbarques.get(c.embarque_id);
        totalCosto += convertirAMXN(c.monto, c.moneda, tipoCambio?.usd || 17.5, tipoCambio?.eur || 19);
      });
      
      const profit = calcularUtilidad(totalVenta, totalCosto);
      const margen = calcularMargen(totalVenta, totalCosto);
      
      return { modo, profit, margen };
    });
  }, [conceptos, embarquesFiltrados]);

  const margenPromedio = useMemo(() => {
    if (!conceptos) return 0;
    const embarqueIds = new Set(embarquesFiltrados.map(e => e.id));
    
    let totalVenta = 0, totalCosto = 0;
    const tiposCambioEmbarques = new Map(embarquesFiltrados.map(e => [e.id, { usd: e.tipo_cambio_usd, eur: e.tipo_cambio_eur }]));
    
    conceptos.ventas.filter(v => embarqueIds.has(v.embarque_id)).forEach(v => {
      const tipoCambio = tiposCambioEmbarques.get(v.embarque_id);
      totalVenta += convertirAMXN(v.total, v.moneda, tipoCambio?.usd || 17.5, tipoCambio?.eur || 19);
    });
    
    conceptos.costos.filter(c => embarqueIds.has(c.embarque_id)).forEach(c => {
      const tipoCambio = tiposCambioEmbarques.get(c.embarque_id);
      totalCosto += convertirAMXN(c.monto, c.moneda, tipoCambio?.usd || 17.5, tipoCambio?.eur || 19);
    });
    
    return calcularMargen(totalVenta, totalCosto);
  }, [conceptos, embarquesFiltrados]);

  // Original client profitability data (unfiltered)
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
        totalVenta += convertirAMXN(venta.total, venta.moneda, tipoCambio?.usd || 17.5, tipoCambio?.eur || 19);
      });
      conceptos.costos.filter(costo => idsEmbarquesCliente.has(costo.embarque_id)).forEach(costo => {
        const tipoCambio = tiposCambioEmbarques.get(costo.embarque_id);
        totalCosto += convertirAMXN(costo.monto, costo.moneda, tipoCambio?.usd || 17.5, tipoCambio?.eur || 19);
      });
      return { nombre: cliente.nombre.split(' ').slice(0, 3).join(' '), embarques: embarquesDelCliente.length, venta: totalVenta, costo: totalCosto, utilidad: calcularUtilidad(totalVenta, totalCosto) };
    }).filter(cliente => cliente.embarques > 0).sort((a, b) => b.utilidad - a.utilidad);
  }, [clientes, embarques, conceptos]);

  return (
    <div className="min-h-screen bg-slate-50 space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Reportes</h1>
            <p className="text-sm text-muted-foreground">Dashboard completo de métricas y análisis</p>
          </div>
          <div className="flex gap-2">
            {(['mes', 'trimestre', 'año'] as const).map((periodo) => (
              <Button
                key={periodo}
                variant={periodoSeleccionado === periodo ? "default" : "outline"}
                onClick={() => setPeriodoSeleccionado(periodo)}
                className="capitalize"
              >
                {periodo === 'mes' ? 'Este mes' : periodo === 'trimestre' ? 'Último trimestre' : 'Este año'}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Panorama General */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border-0">
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-lg font-semibold">Panorama General</h2>
          <Badge variant="secondary">{embarquesFiltrados.length} embarques</Badge>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl shadow-sm border-0 border-l-4 border-l-primary">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Embarques Activos</p>
              {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-bold mt-1">{embarquesActivos}</p>}
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm border-0 border-l-4 border-l-accent">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Profit Total USD</p>
              {loading ? <Skeleton className="h-8 w-24 mt-1" /> : (
                <p className={`text-2xl font-bold mt-1 ${profitTotalUSD >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  ${profitTotalUSD.toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm border-0 border-l-4 border-l-secondary">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cotizaciones Creadas</p>
              {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-bold mt-1">{cotizacionesCreadas}</p>}
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm border-0 border-l-4 border-l-muted">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasa de Conversión</p>
              {loading ? <Skeleton className="h-8 w-20 mt-1" /> : (
                <p className={`text-2xl font-bold mt-1 ${tasaConversion >= 20 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {tasaConversion.toFixed(1)}%
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Operaciones */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border-0">
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-lg font-semibold">Operaciones</h2>
          <Badge variant="secondary">{embarquesFiltrados.length} embarques</Badge>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Embarques por Estado</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-[250px] w-full" /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={embarquesPorEstado} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={80} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Embarques por Modo</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-[250px] w-full" /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={embarquesPorModo}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top 5 Demoras */}
        <Card className="rounded-2xl shadow-sm border-0 mt-6">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top 5 Embarques con Demoras</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expediente</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead>Días Demora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {embarquesDemorados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">No hay embarques con demoras significativas</TableCell>
                    </TableRow>
                  ) : (
                    embarquesDemorados.map((embarque, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{embarque.expediente}</TableCell>
                        <TableCell>{embarque.cliente}</TableCell>
                        <TableCell>{embarque.eta}</TableCell>
                        <TableCell className="text-red-500 font-medium">{embarque.diasDemora} días</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ventas */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border-0">
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-lg font-semibold">Ventas</h2>
          <Badge variant="secondary">{cotizacionesCreadas} cotizaciones</Badge>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Cotizaciones por Mes (Últimos 6 meses)</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-[250px] w-full" /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={cotizacionesPorMes}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="cotizaciones" stroke="hsl(38, 92%, 50%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Cotizaciones por Estado</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cotizacionesPorEstado.map((estado, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{estado.estado}</TableCell>
                        <TableCell>{estado.count}</TableCell>
                        <TableCell>{estado.porcentaje}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top 5 Operadores */}
        <Card className="rounded-2xl shadow-sm border-0 mt-6">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top 5 Operadores por Cotizaciones Aceptadas</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operador</TableHead>
                    <TableHead>Cotizaciones Aceptadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topOperadores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">No hay cotizaciones aceptadas en el período</TableCell>
                    </TableRow>
                  ) : (
                    topOperadores.map((operador, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{operador.operador}</TableCell>
                        <TableCell className="text-emerald-600 font-medium">{operador.cotizaciones}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rentabilidad */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border-0">
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-lg font-semibold">Rentabilidad</h2>
          <Badge variant="secondary">{embarquesFiltrados.length} embarques</Badge>
        </div>
        
        {/* Margen Promedio Card */}
        <Card className="rounded-2xl shadow-sm border-0 border-l-4 border-l-accent mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Margen Promedio del Período</p>
                {loading ? <Skeleton className="h-10 w-24 mt-2" /> : (
                  <p className={`text-3xl font-bold mt-2 ${margenPromedio >= 15 ? 'text-emerald-600' : margenPromedio < 0 ? 'text-red-500' : 'text-orange-500'}`}>
                    {margenPromedio.toFixed(1)}%
                  </p>
                )}
              </div>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${margenPromedio >= 15 ? 'bg-emerald-100' : margenPromedio < 0 ? 'bg-red-100' : 'bg-orange-100'}`}>
                <span className={`text-2xl ${margenPromedio >= 15 ? 'text-emerald-600' : margenPromedio < 0 ? 'text-red-500' : 'text-orange-500'}`}>
                  {margenPromedio >= 15 ? '📈' : margenPromedio < 0 ? '📉' : '📊'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Profit USD por Mes (Últimos 6 meses)</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-[250px] w-full" /> : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={profitPorMes}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis tickFormatter={(valor) => `$${(valor / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(valor: number) => [`$${valor.toLocaleString()}`, 'Profit']} />
                    <Bar dataKey="profit" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-0">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Profit por Modo de Transporte</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Modo</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Margen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profitPorModo.map((modo, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{modo.modo}</TableCell>
                        <TableCell className={modo.profit >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                          {formatCurrency(modo.profit)}
                        </TableCell>
                        <TableCell className={modo.margen >= 15 ? 'text-emerald-600' : modo.margen < 0 ? 'text-red-500' : 'text-orange-500'}>
                          {modo.margen.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Original sections - Rentabilidad por Cliente (preserved as requested) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border-0">
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-lg font-semibold">Rentabilidad por Cliente</h2>
          <Badge variant="secondary">Todos los datos</Badge>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="rounded-2xl shadow-sm border-0">
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

          <Card className="rounded-2xl shadow-sm border-0">
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

        {/* Top Clientes Table (preserved as requested) */}
        <Card className="rounded-2xl shadow-sm border-0">
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
                      <TableCell className={cliente.utilidad >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>{formatCurrency(cliente.utilidad)}</TableCell>
                      <TableCell>{calcularMargen(cliente.venta, cliente.venta - cliente.utilidad).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}