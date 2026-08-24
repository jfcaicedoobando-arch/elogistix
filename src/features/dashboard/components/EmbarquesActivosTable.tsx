import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { statusColumn } from "@/components/shared/dataTable/columnBuilders";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { formatDate, formatCurrency, getOrigen, getDestino, toTitleCase, PLACEHOLDER_VACIO } from "@/lib/formatters";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { KpiCard } from "@/components/shared/KpiCard";
import type { EmbarqueMesSiguiente, ResumenFacturacion } from "@/features/dashboard/hooks";

import { CalendarDays, DollarSign, TrendingUp, FileCheck, Ship } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { Hint } from "@/components/shared/Hint";

interface Props {
  embarques: EmbarqueMesSiguiente[];
  resumen: ResumenFacturacion;
  isLoading: boolean;
  hideFinancials?: boolean;
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
    cell: ({ row }) => (
      <Hint label={row.original.cliente_nombre}>
        <span>{toTitleCase(row.original.cliente_nombre)}</span>
      </Hint>
    ),
  },
  {
    id: "modo", header: "Modo",
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5">
        <ModoIcon modo={row.original.modo} size={14} />
        <span>{row.original.modo}</span>
      </span>
    ),
  },
  {
    id: "ruta", header: "Origen → Destino",
    meta: { className: "max-w-[180px] truncate" },
    cell: ({ row }) => `${getOrigen(row.original)} → ${getDestino(row.original)}`,
  },
  {
    id: "contenedor", header: "Contenedor",
    accessorFn: (e) => e.contenedor, enableSorting: true,
    sortingFn: sortByString<EmbarqueMesSiguiente>((e) => e.contenedor),
    meta: { className: "font-mono whitespace-nowrap" },
    // VB-20/VB-30: placeholder vacío unificado (em dash), no guion ASCII.
    cell: ({ row }) => row.original.contenedor || <span className="text-muted-foreground">{PLACEHOLDER_VACIO}</span>,
  },
  {
    id: "eta", header: "ETA",
    accessorFn: (e) => e.eta, enableSorting: true,
    sortingFn: sortByDate<EmbarqueMesSiguiente>((e) => e.eta),
    cell: ({ row }) => row.original.eta ? formatDate(row.original.eta) : PLACEHOLDER_VACIO,
  },
  statusColumn<EmbarqueMesSiguiente>({
    id: "estado",
    header: "Estado",
    domain: "embarque",
    accessor: (e) => e.estadoReal,
  }),
  {
    id: "profit", header: "Utilidad MXN",
    accessorFn: (e) => e.profitMXN, enableSorting: true,
    sortingFn: sortByNumber<EmbarqueMesSiguiente>((e) => e.profitMXN),
    meta: { className: "text-right tabular-nums", headerClassName: "text-right" },
    cell: ({ row }) => {
      const e = row.original;
      return (
        <Hint label={`Venta ${formatCurrency(e.ventaMXN, "MXN")} · Costo ${formatCurrency(e.costoMXN, "MXN")} (TC USD ${e.tipoCambioUSD.toFixed(2)})`}>
          <span className={`font-medium ${e.profitMXN >= 0 ? "text-success" : "text-destructive"}`}>
            {formatCurrency(e.profitMXN, "MXN")}
          </span>
        </Hint>
      );
    },
  },
  {
    id: "facturado", header: "Facturado",
    meta: { className: "text-center", headerClassName: "text-center" },
    cell: ({ row }) => (
      <Badge variant="secondary" className={`text-label ${
        row.original.facturado
          ? "bg-success/15 text-success border-success/30"
          : "bg-muted text-muted-foreground"
      }`}>
        {row.original.facturado ? "Sí" : "No"}
      </Badge>
    ),
  },
]);

export function EmbarquesActivosTable({ embarques, resumen, isLoading, hideFinancials = false }: Props) {
  const nombreMesCap = resumen.nombreMes
    ? resumen.nombreMes.charAt(0).toUpperCase() + resumen.nombreMes.slice(1)
    : "Próximo mes";
  const pctFacturados = resumen.totalEmbarques > 0
    ? Math.round((resumen.facturados / resumen.totalEmbarques) * 100)
    : 0;
  const colorClass = pctFacturados >= 75 ? "[&>div]:bg-success" : pctFacturados >= 25 ? "[&>div]:bg-warning" : "[&>div]:bg-destructive";

  const visibleColumns = useMemo(
    () => (hideFinancials ? columns.filter((c) => c.id !== "profit" && c.id !== "facturado") : columns),
    [hideFinancials],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 flex-wrap">
          <CalendarDays className="h-4 w-4 text-primary shrink-0" />
          <span>Embarques activos — próximo mes ({nombreMesCap})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen de facturación */}
        <div className={`grid gap-3 ${hideFinancials ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"}`}>
          <KpiCard label="Embarques" value={resumen.totalEmbarques} icon={Ship} iconVariant="chip" />
          {!hideFinancials && (
            <>
              <KpiCard
                label="Venta MXN"
                value={formatCurrency(resumen.ventaMXN, "MXN")}
                icon={DollarSign}
                iconVariant="chip"
                variant="info"
              />
              <KpiCard
                label="Costo MXN"
                value={formatCurrency(resumen.costoMXN, "MXN")}
                icon={DollarSign}
                iconVariant="chip"
                variant="warning"
              />
              <KpiCard
                label="Utilidad MXN"
                value={formatCurrency(resumen.profitMXN, "MXN")}
                icon={TrendingUp}
                iconVariant="chip"
                variant={resumen.profitMXN >= 0 ? "success" : "destructive"}
              />
              <KpiCard
                label="Facturados"
                value={`${resumen.facturados}/${resumen.totalEmbarques}`}
                icon={FileCheck}
                iconVariant="chip"
                delta={`${pctFacturados}%`}
                className="col-span-2 md:col-span-3 lg:col-span-1"
              >
                <Progress value={pctFacturados} className={`h-1.5 mt-1.5 ${colorClass}`} />
              </KpiCard>
            </>
          )}
        </div>

        <DataTable
          columns={visibleColumns}
          data={embarques}
          isLoading={isLoading}
          emptyMessage={`Sin embarques con ETA en ${nombreMesCap}`}
          getRowHref={(e) => `/embarques/${e.id}`}
          rowKey={(e) => e.id}
          density={TABLE_DENSITY.embebida}
        />
      </CardContent>
    </Card>
  );
}
