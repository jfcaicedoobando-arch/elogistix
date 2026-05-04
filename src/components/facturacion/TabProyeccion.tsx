import { ChevronLeft, ChevronRight, Download, Package, Wallet, TrendingUp, CheckCircle2, Calendar, Info, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { KpiCard } from "@/components/operaciones/KpiCard";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { formatCurrency, formatCurrencyCompact, formatDate, toTitleCase } from "@/lib/formatters";
import { useTabProyeccionController } from "@/hooks/facturacion/useTabProyeccionController";
import type { GrupoProyeccion } from "@/lib/domain/proyeccionFacturacion";
import { cn } from "@/lib/utils";

export function TabProyeccion() {
  const c = useTabProyeccionController();
  const navigate = useNavigate();

  const columns: DataTableColumn<GrupoProyeccion>[] = [
    {
      key: "expediente", header: "Expediente", width: "w-[120px]", sticky: true,
      className: "font-mono font-medium whitespace-nowrap",
      sortable: true, sortValue: (g) => g.expediente,
      render: (g) => g.expediente,
    },
    {
      key: "cliente", header: "Cliente", width: "min-w-[180px]", className: "max-w-[240px] truncate",
      sortable: true, sortValue: (g) => g.cliente_nombre,
      render: (g) => <span title={toTitleCase(g.cliente_nombre)}>{toTitleCase(g.cliente_nombre)}</span>,
    },
    {
      key: "operador", header: "Operador", width: "w-[140px]", className: "truncate text-sm",
      sortable: true, sortValue: (g) => g.operador,
      render: (g) => g.operador || <span className="text-muted-foreground">—</span>,
    },
    {
      key: "eta", header: "ETA", width: "w-[100px]", className: "text-xs whitespace-nowrap",
      sortable: true, sortValue: (g) => g.eta ?? "",
      render: (g) => g.eta ? formatDate(g.eta) : "—",
    },
    {
      key: "contenedores", header: "Cont.", width: "w-[70px]", align: "center",
      render: (g) => (
        <span className="inline-flex items-center gap-1 text-xs" title={g.contenedores.join(", ")}>
          <Package className="h-3 w-3 opacity-60" />
          <span className="tabular-nums font-medium">{g.totalContenedores || 0}</span>
        </span>
      ),
    },
    {
      key: "venta", header: "Venta (MXN)", width: "w-[140px]", align: "right",
      className: "tabular-nums whitespace-nowrap",
      sortable: true, sortValue: (g) => g.ventaMxn,
      render: (g) => formatCurrency(g.ventaMxn, "MXN"),
    },
    {
      key: "costo", header: "Costo (MXN)", width: "w-[140px]", align: "right",
      className: "tabular-nums whitespace-nowrap text-muted-foreground",
      sortable: true, sortValue: (g) => g.costoMxn,
      render: (g) => formatCurrency(g.costoMxn, "MXN"),
    },
    {
      key: "profit", header: "Profit (MXN)", width: "w-[150px]", align: "right",
      className: "tabular-nums font-medium whitespace-nowrap",
      sortable: true, sortValue: (g) => g.profitMxn,
      render: (g) => (
        <span className={cn(g.profitMxn < 0 ? "text-destructive" : "text-success")}>
          {formatCurrency(g.profitMxn, "MXN")}
        </span>
      ),
    },
    {
      key: "margen", header: "%", width: "w-[70px]", align: "right",
      className: "tabular-nums text-xs",
      sortable: true, sortValue: (g) => g.margenPct,
      render: (g) => (
        <span className={cn(g.margenPct < 0 ? "text-destructive" : g.margenPct < 10 ? "text-warning" : "text-foreground")}>
          {g.margenPct.toFixed(1)}%
        </span>
      ),
    },
    {
      key: "estado", header: "Estado", width: "w-[110px]",
      sortable: true, sortValue: (g) => g.estado,
      render: (g) => g.estado === "Facturado" ? (
        <Badge className="bg-success/15 text-success border border-success/30 hover:bg-success/20">
          Facturado
        </Badge>
      ) : (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
          Pendiente
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header: Selector de mes + Export */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={c.irMesAnterior}
              disabled={!c.puedeIrAtras}
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={c.mesActual.key} onValueChange={c.setMesKey}>
              <SelectTrigger className="w-[200px] font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {c.mesesDisponibles.slice().reverse().map((m) => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={c.irMesSiguiente}
              disabled={!c.puedeIrAdelante}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1" />

          <div className="text-xs text-muted-foreground hidden md:block">
            {c.kpisGlobales.totalExpedientes} expedientes con ETA en {c.mesActual.label}
          </div>

          <Button variant="outline" onClick={c.exportarCsv} disabled={c.grupos.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          titulo="Embarques del mes"
          valor={`${c.kpis.facturados} de ${c.kpis.totalExpedientes} facturados`}
          subtitulo={`${c.kpis.pendientes} pendientes de facturar`}
          icono={Package}
          color="info"
          loading={c.isLoading}
        >
          <div className="mt-2">
            <Progress value={c.kpis.avancePct} className="h-1.5" />
          </div>
        </KpiCard>
        <KpiCard
          titulo="Pendiente de facturar"
          valor={formatCurrencyCompact(c.kpis.ventaPendienteMxn, "MXN")}
          valorTooltip={`${formatCurrency(c.kpis.ventaPendienteMxn, "MXN")} pendiente de facturar (${c.kpis.pendientes} embarques)`}
          subtitulo={`${c.kpis.pendientes} embarques · MXN`}
          icono={Clock}
          color="warning"
          loading={c.isLoading}
        />
        <KpiCard
          titulo="Ya facturado"
          valor={formatCurrencyCompact(c.kpis.ventaFacturadaMxn, "MXN")}
          valorTooltip={`${formatCurrency(c.kpis.ventaFacturadaMxn, "MXN")} facturado (${c.kpis.facturados} embarques)`}
          subtitulo={`${c.kpis.facturados} embarques · MXN`}
          icono={CheckCircle2}
          color="success"
          loading={c.isLoading}
        />
        <KpiCard
          titulo="Profit proyectado (MXN)"
          valor={formatCurrencyCompact(c.kpis.profitProyMxn, "MXN")}
          valorTooltip={`Venta ${formatCurrency(c.kpis.ventaProyMxn, "MXN")} − Costo ${formatCurrency(c.kpis.costoTotalMxn, "MXN")} = ${formatCurrency(c.kpis.profitProyMxn, "MXN")}`}
          subtitulo={`Margen ${c.kpis.margenProyPct.toFixed(1)}% · Venta total ${formatCurrencyCompact(c.kpis.ventaProyMxn, "MXN")}`}
          icono={TrendingUp}
          color={c.kpis.margenProyPct < 10 ? "warning" : "accent"}
          loading={c.isLoading}
        />
      </div>

      {/* Nota de moneda */}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
        <Info className="h-3 w-3" />
        Todos los montos se muestran en MXN. Los conceptos en USD/EUR se convierten al tipo de cambio del propio embarque.
      </p>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <Select value={c.filtroCliente} onValueChange={c.setFiltroCliente}>
            <SelectTrigger className="w-[220px]" aria-label="Filtrar por cliente">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los clientes</SelectItem>
              {c.clientesDisponibles.map((cli) => (
                <SelectItem key={cli} value={cli}>{toTitleCase(cli)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={c.filtroOperador} onValueChange={c.setFiltroOperador}>
            <SelectTrigger className="w-[200px]" aria-label="Filtrar por operador">
              <SelectValue placeholder="Operador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los operadores</SelectItem>
              {c.operadoresDisponibles.map((op) => (
                <SelectItem key={op} value={op}>{op}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={c.filtroEstado} onValueChange={(v) => c.setFiltroEstado(v as typeof c.filtroEstado)}>
            <SelectTrigger className="w-[180px]" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="Facturado">Facturado</SelectItem>
              <SelectItem value="Pendiente">Pendiente de facturar</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabla de detalle */}
      <Card>
        <CardContent className="p-0">
          {!c.isLoading && c.grupos.length === 0 ? (
            <EmptyStateInline
              icon={Calendar}
              message={`Sin embarques con ETA en ${c.mesActual.label}`}
              hint="Selecciona otro mes o ajusta los filtros."
            />
          ) : (
            <DataTable
              columns={columns}
              data={c.grupos}
              isLoading={c.isLoading}
              rowKey={(g) => g.expediente}
              density="comfortable"
              emptyMessage="Sin resultados con los filtros aplicados"
              onRowClick={(g) => {
                if (g.embarqueIds[0]) navigate(`/embarques/${g.embarqueIds[0]}`);
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
