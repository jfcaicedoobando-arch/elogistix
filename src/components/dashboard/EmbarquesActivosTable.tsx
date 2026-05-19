import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";
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

const columns: ColumnDef<EmbarqueMesSiguiente, unknown>[] = defineColumns<EmbarqueMesSiguiente>([
  {
    id: "expediente", header: "Expediente",
    accessorFn: (e) => e.expediente, enableSorting: true,
    sortingFn: sortByString<EmbarqueMesSiguiente>((e) => e.expediente),
    meta: { className: "font-medium", sticky: true },
    cell: ({ row }) => row.original.expediente,
  },
  {
    id: "cliente", header: "Cliente",
    accessorFn: (e) => e.cliente_nombre, enableSorting: true,
    sortingFn: sortByString<EmbarqueMesSiguiente>((e) => e.cliente_nombre),
    meta: { className: "max-w-[180px] truncate" },
    cell: ({ row }) => <span title={row.original.cliente_nombre}>{toTitleCase(row.original.cliente_nombre)}</span>,
  },
  {
    id: "modo", header: "Modo",
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5">
        <ModoIcon modo={row.original.modo} size={14} />
        <span className="text-xs">{row.original.modo}</span>
      </span>
    ),
  },
  {
    id: "ruta", header: "Origen → Destino",
    meta: { className: "text-xs max-w-[180px] truncate" },
    cell: ({ row }) => `${getOrigen(row.original)} → ${getDestino(row.original)}`,
  },
  {
    id: "contenedor", header: "Contenedor",
    accessorFn: (e) => e.contenedor, enableSorting: true,
    sortingFn: sortByString<EmbarqueMesSiguiente>((e) => e.contenedor),
    meta: { className: "text-xs font-mono whitespace-nowrap" },
    cell: ({ row }) => row.original.contenedor || <span className="text-muted-foreground">-</span>,
  },
  {
    id: "eta", header: "ETA",
    accessorFn: (e) => e.eta, enableSorting: true,
    sortingFn: sortByDate<EmbarqueMesSiguiente>((e) => e.eta),
    meta: { className: "text-xs" },
    cell: ({ row }) => row.original.eta ? formatDate(row.original.eta) : "-",
  },
  {
    id: "estado", header: "Estado",
    accessorFn: (e) => e.estadoReal, enableSorting: true,
    sortingFn: sortByString<EmbarqueMesSiguiente>((e) => e.estadoReal),
    cell: ({ row }) => (
      <Badge variant="secondary" className={`text-xs ${getEstadoColor(row.original.estadoReal)}`}>
        {row.original.estadoReal}
      </Badge>
    ),
  },
  {
    id: "profit", header: "Profit MXN",
    accessorFn: (e) => e.profitMXN, enableSorting: true,
    sortingFn: sortByNumber<EmbarqueMesSiguiente>((e) => e.profitMXN),
    meta: { className: "text-right tabular-nums", headerClassName: "text-right" },
    cell: ({ row }) => {
      const e = row.original;
      return (
        <span
          className={`text-xs font-medium ${e.profitMXN >= 0 ? "text-success" : "text-destructive"}`}
          title={`Venta ${formatCurrency(e.ventaMXN, "MXN")} · Costo ${formatCurrency(e.costoMXN, "MXN")} (TC USD ${e.tipoCambioUSD.toFixed(2)})`}
        >
          {formatCurrency(e.profitMXN, "MXN")}
        </span>
      );
    },
  },
  {
    id: "facturado", header: "Facturado",
    meta: { className: "text-center", headerClassName: "text-center" },
    cell: ({ row }) => (
      <Badge variant="secondary" className={`text-[10px] ${
        row.original.facturado
          ? "bg-success/15 text-success border-success/30"
          : "bg-muted text-muted-foreground"
      }`}>
        {row.original.facturado ? "Sí" : "No"}
      </Badge>
    ),
  },
]);

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
              <p className="text-sm font-bold text-foreground truncate">{formatCurrency(resumen.ventaMXN, "MXN")}</p>
              <p className="text-[10px] text-muted-foreground">Venta MXN</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <DollarSign className="h-4 w-4 text-warning shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{formatCurrency(resumen.costoMXN, "MXN")}</p>
              <p className="text-[10px] text-muted-foreground">Costo MXN</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <TrendingUp className={`h-4 w-4 shrink-0 ${resumen.profitMXN >= 0 ? "text-success" : "text-destructive"}`} />
            <div className="min-w-0">
              <p className={`text-sm font-bold truncate ${resumen.profitMXN >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(resumen.profitMXN, "MXN")}
              </p>
              <p className="text-[10px] text-muted-foreground">Profit MXN</p>
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
