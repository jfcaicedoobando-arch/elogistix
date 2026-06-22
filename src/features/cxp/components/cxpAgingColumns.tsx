/**
 * Columnas del aging de CxP: una fila por proveedor con saldo desglosado por
 * antigüedad. Click en proveedor abre `/cxp` filtrado.
 */
import { Link } from "react-router-dom";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CxpAgingRow } from "@/features/cxp/services/cxpAging";

function Money({ value, danger }: { value: number; danger?: boolean }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("tabular-nums", danger && "text-destructive font-medium")}>
      {formatCurrency(value, "MXN")}
    </span>
  );
}

export function buildCxpAgingColumns(): ColumnDef<CxpAgingRow, unknown>[] {
  return defineColumns<CxpAgingRow>([
    {
      id: "proveedor",
      header: "Proveedor",
      accessorKey: "proveedor_nombre",
      cell: ({ row }) => (
        <Link
          to={`/cxp?proveedor=${row.original.proveedor_id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.proveedor_nombre}
        </Link>
      ),
      meta: { sortable: true },
    },
    {
      id: "num_facturas",
      header: "Facturas",
      accessorKey: "num_facturas",
      cell: ({ row }) => <span className="tabular-nums">{row.original.num_facturas}</span>,
      meta: { align: "right", sortable: true },
    },
    {
      id: "vigente",
      header: "Vigente",
      accessorKey: "vigente",
      cell: ({ row }) => <Money value={row.original.vigente} />,
      meta: { align: "right", sortable: true },
    },
    {
      id: "d_1_30",
      header: "1-30 días",
      accessorKey: "d_1_30",
      cell: ({ row }) => <Money value={row.original.d_1_30} danger={row.original.d_1_30 > 0} />,
      meta: { align: "right", sortable: true },
    },
    {
      id: "d_31_60",
      header: "31-60 días",
      accessorKey: "d_31_60",
      cell: ({ row }) => <Money value={row.original.d_31_60} danger={row.original.d_31_60 > 0} />,
      meta: { align: "right", sortable: true },
    },
    {
      id: "d_61_90",
      header: "61-90 días",
      accessorKey: "d_61_90",
      cell: ({ row }) => <Money value={row.original.d_61_90} danger={row.original.d_61_90 > 0} />,
      meta: { align: "right", sortable: true },
    },
    {
      id: "mas_90",
      header: ">90 días",
      accessorKey: "mas_90",
      cell: ({ row }) => <Money value={row.original.mas_90} danger={row.original.mas_90 > 0} />,
      meta: { align: "right", sortable: true },
    },
    {
      id: "saldo_total",
      header: "Total",
      accessorKey: "saldo_total",
      cell: ({ row }) => (
        <span className="tabular-nums font-semibold">
          {formatCurrency(row.original.saldo_total, "MXN")}
        </span>
      ),
      meta: { align: "right", sortable: true },
    },
  ]);
}
