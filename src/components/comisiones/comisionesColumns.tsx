import { Badge } from "@/components/ui/badge";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import type { ComisionDevengada, EstadoComision } from "@/features/comisiones/services";

const ESTADO_COLOR: Record<EstadoComision, string> = {
  Devengada: "bg-warning/10 text-warning border-warning/20",
  Liquidada: "bg-success/10 text-success border-success/20",
  Cancelada: "bg-muted text-muted-foreground border-border",
};

export function buildComisionesColumns(): ColumnDef<ComisionDevengada, unknown>[] {
  return defineColumns<ComisionDevengada>([
    {
      id: "fecha", header: "Fecha",
      accessorFn: (c) => c.created_at, enableSorting: true,
      sortingFn: sortByDate<ComisionDevengada>((c) => c.created_at),
      meta: { width: "w-[110px]", className: "whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.created_at.slice(0, 10)),
    },
    {
      id: "expediente", header: "Expediente",
      meta: { width: "w-[140px]", className: "font-mono text-xs" },
      cell: ({ row }) => row.original.expediente ?? "—",
    },
    {
      id: "cliente", header: "Cliente",
      meta: { width: "min-w-[140px]", className: "max-w-[200px] truncate" },
      cell: ({ row }) => row.original.cliente_nombre ? toTitleCase(row.original.cliente_nombre) : "—",
    },
    {
      id: "factura", header: "Factura",
      meta: { width: "w-[110px]", className: "font-mono text-xs" },
      cell: ({ row }) => row.original.factura_numero ?? "—",
    },
    {
      id: "cobrado", header: "Cobrado (MXN)",
      accessorFn: (c) => c.monto_cobrado_mxn,
      sortingFn: sortByNumber<ComisionDevengada>((c) => c.monto_cobrado_mxn),
      enableSorting: true,
      meta: { width: "w-[130px]", className: "text-right tabular-nums" },
      cell: ({ row }) => formatCurrency(row.original.monto_cobrado_mxn, "MXN"),
    },
    {
      id: "utilidad", header: "Utilidad prorrateada",
      meta: { width: "w-[150px]", className: "text-right tabular-nums" },
      cell: ({ row }) => formatCurrency(row.original.utilidad_prorrateada_mxn, "MXN"),
    },
    {
      id: "pct", header: "%",
      meta: { width: "w-[60px]", className: "text-right tabular-nums" },
      cell: ({ row }) => `${row.original.porcentaje_aplicado.toFixed(1)}%`,
    },
    {
      id: "comision", header: "Comisión (MXN)",
      accessorFn: (c) => c.comision_mxn,
      sortingFn: sortByNumber<ComisionDevengada>((c) => c.comision_mxn),
      enableSorting: true,
      meta: { width: "w-[130px]", className: "text-right font-semibold tabular-nums" },
      cell: ({ row }) => formatCurrency(row.original.comision_mxn, "MXN"),
    },
    {
      id: "estado", header: "Estado",
      accessorFn: (c) => c.estado,
      sortingFn: sortByString<ComisionDevengada>((c) => c.estado),
      meta: { width: "w-[110px]" },
      cell: ({ row }) => (
        <Badge variant="outline" className={ESTADO_COLOR[row.original.estado]}>
          {row.original.estado}
        </Badge>
      ),
    },
    {
      id: "nota", header: "Nota",
      meta: { width: "min-w-[120px]", className: "text-xs text-muted-foreground" },
      cell: ({ row }) => row.original.nota ?? "—",
    },
  ]);
}
