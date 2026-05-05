import { ChevronLeft, ChevronRight, Download, Package, TrendingUp, CheckCircle2, Calendar, Info, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { useTabProyeccionController } from "@/hooks/facturacion/useTabProyeccionController";
import { DIAS_HUECO, type GrupoProyeccion } from "@/lib/domain/proyeccionFacturacion";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "info" | "danger";

const TONE: Record<Tone, { bar: string; chip: string; text: string; ring: string }> = {
  success: { bar: "bg-success", chip: "bg-success/10 text-success", text: "text-success", ring: "ring-success/20" },
  warning: { bar: "bg-warning", chip: "bg-warning/10 text-warning", text: "text-warning", ring: "ring-warning/20" },
  info: { bar: "bg-primary", chip: "bg-primary/10 text-primary", text: "text-primary", ring: "ring-primary/20" },
  danger: { bar: "bg-destructive", chip: "bg-destructive/10 text-destructive", text: "text-destructive", ring: "ring-destructive/30" },
};

/** Tarjeta del bloque "Cierre [Mes]" — compacta, dual currency. */
function CierreCard({
  tone, icon: Icon, titulo, embarques, lineas, footer, highlight,
}: {
  tone: Tone;
  icon: React.ElementType;
  titulo: string;
  embarques: number;
  lineas: { label: string; value: string; emphasis?: boolean; className?: string }[];
  footer?: React.ReactNode;
  highlight?: boolean;
}) {
  const s = TONE[tone];
  return (
    <div className={cn(
      "relative rounded-xl border bg-card overflow-hidden h-full",
      highlight && `ring-2 ${s.ring}`,
    )}>
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", s.bar)} />
      <div className="p-4 pl-5 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <div className={cn("rounded-lg p-1.5", s.chip)}>
            <Icon className="h-4 w-4" />
          </div>
          <h4 className={cn("text-[11px] font-semibold tracking-wide uppercase leading-tight", s.text)}>
            {titulo}
          </h4>
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-muted-foreground">Embarques</span>
            <span className="text-2xl font-bold tabular-nums">{embarques}</span>
          </div>
          {lineas.map((l) => (
            <div key={l.label} className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{l.label}</span>
              <span
                className={cn(
                  "tabular-nums whitespace-nowrap",
                  l.emphasis ? "text-base font-semibold" : "text-sm font-medium",
                  l.className,
                )}
                title={l.value}
              >
                {l.value}
              </span>
            </div>
          ))}
        </div>
        {footer && <div className="mt-3 pt-2 border-t">{footer}</div>}
      </div>
    </div>
  );
}

export function TabProyeccion() {
  const c = useTabProyeccionController();
  const navigate = useNavigate();

  const columns: DataTableColumn<GrupoProyeccion>[] = [
    {
      key: "expediente", header: "Expediente", width: "w-[110px]", sticky: true,
      className: "font-mono font-medium whitespace-nowrap text-xs",
      sortable: true, sortValue: (g) => g.expediente,
      render: (g) => g.expediente,
    },
    {
      key: "cliente", header: "Cliente", width: "min-w-[160px]", className: "max-w-[220px] truncate text-sm",
      sortable: true, sortValue: (g) => g.cliente_nombre,
      render: (g) => <span title={toTitleCase(g.cliente_nombre)}>{toTitleCase(g.cliente_nombre)}</span>,
    },
    {
      key: "etd", header: "ETD", width: "w-[90px]", className: "text-xs whitespace-nowrap",
      sortable: true, sortValue: (g) => g.etd ?? "",
      render: (g) => g.etd ? formatDate(g.etd) : "—",
    },
    {
      key: "eta", header: "ETA", width: "w-[90px]", className: "text-xs whitespace-nowrap",
      sortable: true, sortValue: (g) => g.eta ?? "",
      render: (g) => g.eta ? formatDate(g.eta) : "—",
    },
    {
      key: "contenedores", header: "Cont.", width: "w-[60px]", align: "center",
      render: (g) => (
        <span className="inline-flex items-center gap-1 text-xs" title={g.contenedores.join(", ")}>
          <Package className="h-3 w-3 opacity-60" />
          <span className="tabular-nums font-medium">{g.totalContenedores || 0}</span>
        </span>
      ),
    },
    {
      key: "venta_usd", header: "Venta USD", width: "w-[120px]", align: "right",
      className: "tabular-nums whitespace-nowrap text-sm",
      sortable: true, sortValue: (g) => g.ventaUsd,
      render: (g) => formatCurrency(g.ventaUsd, "USD"),
    },
    {
      key: "venta_mxn", header: "Venta MXN", width: "w-[130px]", align: "right",
      className: "tabular-nums whitespace-nowrap text-sm font-medium",
      sortable: true, sortValue: (g) => g.ventaMxn,
      render: (g) => formatCurrency(g.ventaMxn, "MXN"),
    },
    {
      key: "estado", header: "Estado", width: "w-[140px]",
      sortable: true, sortValue: (g) => g.estado,
      render: (g) => {
        if (g.estado === "Facturado") {
          return (
            <Badge className="bg-success/15 text-success border border-success/30 hover:bg-success/20">
              Facturado
            </Badge>
          );
        }
        if (g.estado === "Hueco") {
          return (
            <Badge className="bg-destructive/15 text-destructive border border-destructive/40 hover:bg-destructive/20 gap-1">
              <AlertTriangle className="h-3 w-3" />
              Hueco{g.diasDesdeEtd != null ? ` · ${g.diasDesdeEtd}d` : ""}
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
            Pendiente
          </Badge>
        );
      },
    },
  ];

  const k = c.kpis;

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

      {/* Bloque "Cierre [Mes Año]" — 4 tarjetas */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
              Cierre {c.mesActual.label}
            </h3>
            <div className="flex items-center gap-2">
              {k.huecos > 0 && (
                <Badge className="bg-destructive/15 text-destructive border border-destructive/40 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {k.huecos} {k.huecos === 1 ? "hueco urgente" : "huecos urgentes"}
                </Badge>
              )}
              <Badge variant="outline" className="font-mono text-xs">
                {k.facturados}/{k.totalExpedientes} facturados · {k.avancePct.toFixed(0)}%
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <CierreCard
              tone="success"
              icon={CheckCircle2}
              titulo="Facturado"
              embarques={k.facturados}
              lineas={[
                { label: "USD", value: formatCurrency(k.ventaFacturadaUsd, "USD"), emphasis: true },
                { label: "MXN", value: formatCurrency(k.ventaFacturadaMxn, "MXN"), emphasis: true },
              ]}
            />
            <CierreCard
              tone="warning"
              icon={Clock}
              titulo="Pendiente de facturar"
              embarques={k.pendientes + k.huecos}
              lineas={[
                { label: "USD", value: formatCurrency(k.ventaPendienteUsd, "USD"), emphasis: true },
                { label: "MXN", value: formatCurrency(k.ventaPendienteMxn, "MXN"), emphasis: true },
              ]}
            />
            <CierreCard
              tone="danger"
              icon={AlertTriangle}
              titulo={`Hueco (ETD + ${DIAS_HUECO}d)`}
              embarques={k.huecos}
              highlight={k.huecos > 0}
              lineas={[
                { label: "USD", value: formatCurrency(k.ventaHuecoUsd, "USD"), emphasis: true },
                { label: "MXN", value: formatCurrency(k.ventaHuecoMxn, "MXN"), emphasis: true },
              ]}
              footer={
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Proveedor ya facturó, cliente sin factura. Urgente.
                </p>
              }
            />
            <CierreCard
              tone="info"
              icon={TrendingUp}
              titulo="Proyectado total"
              embarques={k.totalExpedientes}
              lineas={[
                { label: "Venta USD", value: formatCurrency(k.ventaProyUsd, "USD") },
                { label: "Venta MXN", value: formatCurrency(k.ventaProyMxn, "MXN") },
                { label: "Costo MXN", value: formatCurrency(k.costoTotalMxn, "MXN"), className: "text-muted-foreground" },
                {
                  label: `Profit (${k.margenProyPct.toFixed(1)}%)`,
                  value: formatCurrency(k.profitProyMxn, "MXN"),
                  emphasis: true,
                  className: k.margenProyPct < 0 ? "text-destructive" : k.margenProyPct < 10 ? "text-warning" : "text-success",
                },
              ]}
            />
          </div>

          {/* Barra de avance */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Avance de facturación</span>
              <span className="tabular-nums font-medium">{k.avancePct.toFixed(0)}%</span>
            </div>
            <Progress value={k.avancePct} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Nota informativa */}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
        <Info className="h-3 w-3" />
        Montos USD y MXN calculados con el tipo de cambio del propio embarque. Un embarque pasa a "Hueco" cuando han pasado más de {DIAS_HUECO} días desde el ETD y aún no se ha facturado al cliente.
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
            <SelectTrigger className="w-[200px]" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="Facturado">Facturado</SelectItem>
              <SelectItem value="Pendiente">Pendiente de facturar</SelectItem>
              <SelectItem value="Hueco">⚠️ Hueco (urgente)</SelectItem>
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
