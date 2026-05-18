import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { formatDate, formatCurrency, getOrigen, getDestino, toTitleCase } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { ModoIcon } from "@/components/shared/ModoIcon";
import type { EmbarqueMesSiguiente, ResumenFacturacion } from "@/hooks/dashboard";

import { CalendarDays, DollarSign, TrendingUp, FileCheck, Package } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Props {
  embarques: EmbarqueMesSiguiente[];
  resumen: ResumenFacturacion;
  isLoading: boolean;
}

const columns: DataTableColumn<EmbarqueMesSiguiente>[] = [
  { key: "expediente", header: "Expediente", className: "font-medium", sticky: true, sortable: true, sortValue: (e) => e.expediente, render: (e) => e.expediente },
  { key: "cliente", header: "Cliente", className: "max-w-[180px] truncate", sortable: true, sortValue: (e) => e.cliente_nombre, render: (e) => <span title={e.cliente_nombre}>{toTitleCase(e.cliente_nombre)}</span> },
  {
    key: "modo", header: "Modo", render: (e) => (
      <span className="flex items-center gap-1.5">
        <ModoIcon modo={e.modo} size={14} />
        <span className="text-xs">{e.modo}</span>
      </span>
    ),
  },
  {
    key: "ruta", header: "Origen → Destino", className: "text-xs max-w-[180px] truncate", render: (e) => `${getOrigen(e)} → ${getDestino(e)}`,
  },
  {
    key: "contenedor", header: "Contenedor", className: "text-xs font-mono whitespace-nowrap", sortable: true,
    sortValue: (e) => e.contenedor || "",
    render: (e) => e.contenedor || <span className="text-muted-foreground">-</span>,
  },
  { key: "eta", header: "ETA", className: "text-xs", sortable: true, sortValue: (e) => e.eta || "", render: (e) => e.eta ? formatDate(e.eta) : "-" },
  {
    key: "estado", header: "Estado", sortable: true, sortValue: (e) => e.estadoReal, render: (e) => (
      <Badge variant="secondary" className={`text-xs ${getEstadoColor(e.estadoReal)}`}>
        {e.estadoReal}
      </Badge>
    ),
  },
  {
    key: "profit", header: "Profit", className: "text-right tabular-nums", headerClassName: "text-right",
    sortable: true, sortValue: (e) => e.profit,
    render: (e) => (
      <span className={`text-xs font-medium ${e.profit >= 0 ? "text-success" : "text-destructive"}`}>
        {formatCurrency(e.profit, "USD")}
      </span>
    ),
  },
  {
    key: "facturado", header: "Facturado", className: "text-center", headerClassName: "text-center",
    render: (e) => (
      <Badge variant="secondary" className={`text-[10px] ${
        e.facturado
          ? "bg-success/15 text-success border-success/30"
          : "bg-muted text-muted-foreground"
      }`}>
        {e.facturado ? "Sí" : "No"}
      </Badge>
    ),
  },
];

export function EmbarquesActivosTable({ embarques, resumen, isLoading }: Props) {
  const navigate = useNavigate();
  const nombreMesCap = resumen.nombreMes
    ? resumen.nombreMes.charAt(0).toUpperCase() + resumen.nombreMes.slice(1)
    : "Próximo mes";
  const pctFacturados = resumen.totalEmbarques > 0
    ? Math.round((resumen.facturados / resumen.totalEmbarques) * 100)
    : 0;
  const colorClass = pctFacturados >= 75 ? "[&>div]:bg-success" : pctFacturados >= 25 ? "[&>div]:bg-warning" : "[&>div]:bg-destructive";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <CalendarDays className="h-4 w-4 text-primary shrink-0" />
          <span>Embarques activos — próximo mes ({nombreMesCap})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen de facturación */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground">{resumen.totalEmbarques}</p>
              <p className="text-[10px] text-muted-foreground">Embarques</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <DollarSign className="h-4 w-4 text-info shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{formatCurrency(resumen.ventaUSD, "USD")}</p>
              <p className="text-[10px] text-muted-foreground">Venta USD</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <DollarSign className="h-4 w-4 text-warning shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{formatCurrency(resumen.costoUSD, "USD")}</p>
              <p className="text-[10px] text-muted-foreground">Costo USD</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <TrendingUp className={`h-4 w-4 shrink-0 ${resumen.profitUSD >= 0 ? "text-success" : "text-destructive"}`} />
            <div className="min-w-0">
              <p className={`text-sm font-bold truncate ${resumen.profitUSD >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(resumen.profitUSD, "USD")}
              </p>
              <p className="text-[10px] text-muted-foreground">Profit</p>
            </div>
          </div>
          <div className="col-span-2 md:col-span-3 lg:col-span-1 flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-foreground">
                    {resumen.facturados}/{resumen.totalEmbarques}
                  </p>
                  <span className="text-[10px] text-muted-foreground">{pctFacturados}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Facturados</p>
              </div>
            </div>
            <Progress value={pctFacturados} className={`h-1.5 ${colorClass}`} />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={embarques}
          isLoading={isLoading}
          emptyMessage={`Sin embarques con ETA en ${nombreMesCap}`}
          onRowClick={(e) => navigate(`/embarques/${e.id}`)}
          rowKey={(e) => e.id}
          density="compact"
        />
      </CardContent>
    </Card>
  );
}
