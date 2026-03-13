import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { formatDate, getModoIcon, getEstadoColor } from "@/lib/helpers";
import { formatCurrency } from "@/lib/formatters";
import type { EmbarqueMesSiguiente, ResumenFacturacion } from "@/hooks/useDashboardData";

import { CalendarDays, DollarSign, TrendingUp, FileCheck, Package } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Props {
  embarques: EmbarqueMesSiguiente[];
  resumen: ResumenFacturacion;
  isLoading: boolean;
}

function shortName(raw: string) {
  return raw.split(/[,—]/)[0].trim();
}

const columns: DataTableColumn<EmbarqueMesSiguiente>[] = [
  { key: "expediente", header: "Expediente", className: "font-medium", sticky: true, sortable: true, sortValue: (e) => e.expediente, render: (e) => e.expediente },
  { key: "cliente", header: "Cliente", className: "max-w-[180px] truncate", sortable: true, sortValue: (e) => e.cliente_nombre, render: (e) => e.cliente_nombre },
  {
    key: "modo", header: "Modo", render: (e) => (
      <span className="flex items-center gap-1.5">
        <span>{getModoIcon(e.modo)}</span>
        <span className="text-xs">{e.modo}</span>
      </span>
    ),
  },
  {
    key: "ruta", header: "Origen → Destino", className: "text-xs max-w-[180px] truncate", render: (e) => {
      const origen = shortName(e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "-");
      const destino = shortName(e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "-");
      return `${origen} → ${destino}`;
    },
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Embarques — {resumen.nombreMes.charAt(0).toUpperCase() + resumen.nombreMes.slice(1)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen de facturación */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-lg font-bold text-foreground">{resumen.totalEmbarques}</p>
              <p className="text-[10px] text-muted-foreground">Embarques</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <DollarSign className="h-4 w-4 text-info shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">{formatCurrency(resumen.ventaUSD, "USD")}</p>
              <p className="text-[10px] text-muted-foreground">Venta USD</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <DollarSign className="h-4 w-4 text-warning shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">{formatCurrency(resumen.costoUSD, "USD")}</p>
              <p className="text-[10px] text-muted-foreground">Costo USD</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <TrendingUp className={`h-4 w-4 shrink-0 ${resumen.profitUSD >= 0 ? "text-success" : "text-destructive"}`} />
            <div>
              <p className={`text-sm font-bold ${resumen.profitUSD >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(resumen.profitUSD, "USD")}
              </p>
              <p className="text-[10px] text-muted-foreground">Profit</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-bold text-foreground">
                    {resumen.facturados}/{resumen.totalEmbarques}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {resumen.totalEmbarques > 0
                      ? Math.round((resumen.facturados / resumen.totalEmbarques) * 100)
                      : 0}%
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">Facturados</p>
              </div>
            </div>
            {(() => {
              const pct = resumen.totalEmbarques > 0
                ? Math.round((resumen.facturados / resumen.totalEmbarques) * 100)
                : 0;
              const colorClass = pct >= 75 ? "[&>div]:bg-success" : pct >= 25 ? "[&>div]:bg-warning" : "[&>div]:bg-destructive";
              return <Progress value={pct} className={`h-1.5 ${colorClass}`} />;
            })()}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={embarques}
          isLoading={isLoading}
          emptyMessage="Sin embarques programados para el próximo mes"
          onRowClick={(e) => navigate(`/embarques/${e.id}`)}
          rowKey={(e) => e.id}
        />
      </CardContent>
    </Card>
  );
}
