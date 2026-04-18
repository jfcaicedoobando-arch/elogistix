import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart3, Users, DollarSign, TrendingUp, Percent, Download, CalendarIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { exportToCsv } from "@/generators/exportCsv";
import { useRentabilidadClientes } from "@/hooks/useRentabilidadClientes";

const MODOS = [
  { value: "all", label: "Todos los modos" },
  { value: "Marítimo", label: "Marítimo" },
  { value: "Aéreo", label: "Aéreo" },
  { value: "Terrestre", label: "Terrestre" },
  { value: "Multimodal", label: "Multimodal" },
];

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.85)",
  "hsl(var(--primary) / 0.7)",
  "hsl(var(--primary) / 0.6)",
  "hsl(var(--primary) / 0.5)",
  "hsl(var(--primary) / 0.45)",
  "hsl(var(--primary) / 0.4)",
  "hsl(var(--primary) / 0.35)",
  "hsl(var(--primary) / 0.3)",
  "hsl(var(--primary) / 0.25)",
];

export default function Reportes() {
  const navigate = useNavigate();
  const now = new Date();
  const [fechaDesde, setFechaDesde] = useState<Date>(startOfMonth(now));
  const [fechaHasta, setFechaHasta] = useState<Date>(endOfMonth(now));
  const [modo, setModo] = useState("all");
  const [sortField, setSortField] = useState<"profit_usd" | "venta_usd" | "costo_usd" | "margen">("profit_usd");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtros = useMemo(
    () => ({
      fechaDesde: format(fechaDesde, "yyyy-MM-dd"),
      fechaHasta: format(fechaHasta, "yyyy-MM-dd"),
      modo: modo === "all" ? undefined : modo,
    }),
    [fechaDesde, fechaHasta, modo],
  );

  const { clientes, kpis, isLoading } = useRentabilidadClientes(filtros);

  const sorted = useMemo(() => {
    const copy = [...clientes];
    copy.sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      return sortDir === "desc" ? vb - va : va - vb;
    });
    return copy;
  }, [clientes, sortField, sortDir]);

  const top10 = useMemo(
    () =>
      [...clientes]
        .sort((a, b) => b.profit_usd - a.profit_usd)
        .slice(0, 10)
        .map((c) => ({ name: c.cliente_nombre.length > 18 ? c.cliente_nombre.slice(0, 18) + "…" : c.cliente_nombre, profit: Math.round(c.profit_usd * 100) / 100 })),
    [clientes],
  );

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const handleExport = () => {
    exportToCsv("rentabilidad_clientes.csv", [
      { key: "cliente_nombre", label: "Cliente" },
      { key: "total_embarques", label: "Embarques" },
      { key: "venta_usd", label: "Venta USD" },
      { key: "costo_usd", label: "Costo USD" },
      { key: "profit_usd", label: "Profit USD" },
      { key: "margen", label: "Margen %" },
    ], sorted.map((c) => ({ ...c, margen: c.margen.toFixed(1) })));
  };

  const margenBadge = (m: number) => {
    if (m >= 20) return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{m.toFixed(1)}%</Badge>;
    if (m >= 10) return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">{m.toFixed(1)}%</Badge>;
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{m.toFixed(1)}%</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rentabilidad por Cliente</h1>
          <p className="text-sm text-muted-foreground">P&L agrupado por cuenta con filtros de periodo y modo</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={sorted.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Desde</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal")}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(fechaDesde, "dd MMM yyyy", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={fechaDesde} onSelect={(d) => d && setFechaDesde(d)} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Hasta</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal")}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(fechaHasta, "dd MMM yyyy", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={fechaHasta} onSelect={(d) => d && setFechaHasta(d)} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Modo</label>
          <Select value={modo} onValueChange={setModo}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODOS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Clientes con operaciones", value: kpis.totalClientes, icon: Users, color: "bg-blue-50 text-blue-600", fmt: (v: number) => String(v) },
          { label: "Revenue total USD", value: kpis.revenue, icon: DollarSign, color: "bg-emerald-50 text-emerald-600", fmt: (v: number) => formatCurrency(v, "USD") },
          { label: "Profit total USD", value: kpis.profit, icon: TrendingUp, color: "bg-violet-50 text-violet-600", fmt: (v: number) => formatCurrency(v, "USD") },
          { label: "Margen promedio", value: kpis.margenProm, icon: Percent, color: "bg-amber-50 text-amber-600", fmt: (v: number) => v.toFixed(1) + "%" },
        ].map((k) => (
          <Card key={k.label} className="rounded-2xl shadow-sm border-0 bg-card">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`rounded-xl p-3 ${k.color}`}><k.icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">{k.label}</p>
                {isLoading ? <Skeleton className="h-7 w-20 mt-1" /> : <p className="text-2xl font-bold text-foreground">{k.fmt(k.value)}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + Table */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2 rounded-2xl shadow-sm border-0 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" /> Top 10 por Profit
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : top10.length === 0 ? (
              <p className="text-sm text-muted-foreground pt-10 text-center">Sin datos en el periodo seleccionado</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v, "USD")} />
                  <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                    {top10.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="lg:col-span-3 rounded-2xl shadow-sm border-0 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Desglose por Cliente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-center">Embarques</TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort("venta_usd")}>
                      Venta USD {sortField === "venta_usd" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort("costo_usd")}>
                      Costo USD {sortField === "costo_usd" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort("profit_usd")}>
                      Profit USD {sortField === "profit_usd" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </TableHead>
                    <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort("margen")}>
                      Margen {sortField === "margen" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : sorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Sin datos en el periodo seleccionado
                      </TableCell>
                    </TableRow>
                  ) : (
                    sorted.map((c) => (
                      <TableRow key={c.cliente_id} className="cursor-pointer" onClick={() => navigate(`/clientes/${c.cliente_id}`)}>
                        <TableCell className="font-medium max-w-[200px] truncate">{c.cliente_nombre}</TableCell>
                        <TableCell className="text-center">{c.total_embarques}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(c.venta_usd, "USD")}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(c.costo_usd, "USD")}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(c.profit_usd, "USD")}</TableCell>
                        <TableCell className="text-center">{margenBadge(c.margen)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
