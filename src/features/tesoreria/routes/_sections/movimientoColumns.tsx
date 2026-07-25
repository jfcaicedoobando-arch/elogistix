/**
 * Columnas de la tabla de movimientos bancarios en /tesoreria/conciliacion.
 * Extraído de `TesoreriaConciliacion.tsx` (v13.317.9).
 */
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import type { MovimientoBBVA } from "@/features/tesoreria/services";

const ESTADO_COLOR: Record<string, string> = {
  Pendiente: "bg-warning/10 text-warning border-warning/20",
  Conciliado: "bg-success/10 text-success border-success/20",
  Ignorado: "bg-muted text-muted-foreground border-border",
};

export const movimientoColumns: ColumnDef<MovimientoBBVA, unknown>[] = defineColumns<MovimientoBBVA>([
  {
    id: "fecha",
    header: "Fecha",
    accessorFn: (m) => m.fecha,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs">{formatDate(row.original.fecha)}</span>
    ),
  },
  {
    id: "concepto",
    header: "Concepto",
    accessorFn: (m) => m.concepto,
    cell: ({ row }) => (
      <span className="block max-w-[280px] truncate" title={row.original.concepto}>
        {row.original.concepto}
      </span>
    ),
  },
  {
    id: "cargo",
    header: "Cargo",
    accessorFn: (m) => m.cargo,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="tabular-nums text-destructive">
        {Number(row.original.cargo) > 0 ? formatCurrency(Number(row.original.cargo), "MXN") : ""}
      </span>
    ),
  },
  {
    id: "abono",
    header: "Abono",
    accessorFn: (m) => m.abono,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="tabular-nums text-success">
        {Number(row.original.abono) > 0 ? formatCurrency(Number(row.original.abono), "MXN") : ""}
      </span>
    ),
  },
  {
    id: "estado",
    header: "Estado",
    accessorFn: (m) => m.estado_conciliacion,
    meta: { width: "w-24" },
    cell: ({ row }) => (
      <Badge variant="outline" className={`text-2xs ${ESTADO_COLOR[row.original.estado_conciliacion]}`}>
        {row.original.estado_conciliacion}
      </Badge>
    ),
  },
]) as ColumnDef<MovimientoBBVA, unknown>[];
