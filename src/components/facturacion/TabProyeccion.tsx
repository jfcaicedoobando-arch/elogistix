import { ChevronLeft, ChevronRight, Download, TrendingUp, CheckCircle2, Calendar, Info, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { formatCurrency, toTitleCase } from "@/lib/formatters";
import { useTabProyeccionController } from "@/hooks/facturacion/useTabProyeccionController";
import { HuecoFacturacionCard } from "./HuecoFacturacionCard";
import { CierreCard } from "./CierreCard";
import { proyeccionColumns } from "./proyeccionColumns";

export function TabProyeccion() {
  const c = useTabProyeccionController();
  const navigate = useNavigate();


  const k = c.kpis;
  const profitTone = getProfitToneClass(k.margenProyPct);

  return (
    <div className="space-y-4">
      {/* Hueco de facturación — fijo arriba, indicador global */}
      <HuecoFacturacionCard />

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

      {/* Bloque "Cierre [Mes Año]" */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
              Cierre {c.mesActual.label}
            </h3>
            <Badge variant="outline" className="font-mono text-xs">
              {k.facturados}/{k.totalExpedientes} facturados · {k.avancePct.toFixed(0)}%
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <CierreCard
              tone="success"
              icon={CheckCircle2}
              titulo="✓ Facturado"
              embarques={k.facturados}
              lineas={[
                { label: "USD", value: formatCurrency(k.ventaFacturadaUsd, "USD"), emphasis: true },
                { label: "MXN", value: formatCurrency(k.ventaFacturadaMxn, "MXN"), emphasis: true },
              ]}
            />
            <CierreCard
              tone="warning"
              icon={Clock}
              titulo="⏳ Pendiente de facturar"
              embarques={k.pendientes}
              lineas={[
                { label: "USD", value: formatCurrency(k.ventaPendienteUsd, "USD"), emphasis: true },
                { label: "MXN", value: formatCurrency(k.ventaPendienteMxn, "MXN"), emphasis: true },
              ]}
            />
            <CierreCard
              tone="info"
              icon={TrendingUp}
              titulo="📈 Proyectado (total del mes)"
              embarques={k.totalExpedientes}
              lineas={[
                { label: "Venta USD", value: formatCurrency(k.ventaProyUsd, "USD") },
                { label: "Venta MXN", value: formatCurrency(k.ventaProyMxn, "MXN") },
                { label: "Costo MXN", value: formatCurrency(k.costoTotalMxn, "MXN"), className: "text-muted-foreground" },
                {
                  label: `Profit (${k.margenProyPct.toFixed(1)}%)`,
                  value: formatCurrency(k.profitProyMxn, "MXN"),
                  emphasis: true,
                  className: profitTone,
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

      {/* Nota de moneda */}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
        <Info className="h-3 w-3" />
        Montos en USD y MXN calculados con el tipo de cambio del propio embarque. Los conceptos en otra moneda se convierten automáticamente.
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
              columns={proyeccionColumns}
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
