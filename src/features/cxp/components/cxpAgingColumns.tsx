/**
 * Columnas del aging de CxP: una fila por proveedor con saldo desglosado por
 * antigüedad. Row-click navega a `/cxp?proveedor=...` desde el consumer.
 */
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CxpAgingRow } from "@/features/cxp/services/cxpAging";

function Money({ value, moneda, danger }: { value: number; moneda: string; danger?: boolean }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("tabular-nums", danger && "text-destructive font-medium")}>
      {formatCurrency(value, moneda)}
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
        <span className="font-medium">{row.original.proveedor_nombre}</span>
      ),
      enableSorting: true,
    },
    {
      id: "num_facturas",
      header: "Facturas",
      accessorKey: "num_facturas",
      cell: ({ row }) => <span className="tabular-nums">{row.original.num_facturas}</span>,
      enableSorting: true, meta: { align: "right" },
    },
    {
      id: "vigente",
      header: "Vigente",
      accessorKey: "vigente",
      cell: ({ row }) => <Money value={row.original.vigente} moneda={row.original.moneda} />,
      enableSorting: true, meta: { align: "right" },
    },
    {
      id: "d_1_30",
      header: "1-30 días",
      accessorKey: "d_1_30",
      cell: ({ row }) => <Money value={row.original.d_1_30} moneda={row.original.moneda} danger={row.original.d_1_30 > 0} />,
      enableSorting: true, meta: { align: "right" },
    },
    {
      id: "d_31_60",
      header: "31-60 días",
      accessorKey: "d_31_60",
      cell: ({ row }) => <Money value={row.original.d_31_60} moneda={row.original.moneda} danger={row.original.d_31_60 > 0} />,
      enableSorting: true, meta: { align: "right" },
    },
    {
      id: "d_61_90",
      header: "61-90 días",
      accessorKey: "d_61_90",
      cell: ({ row }) => <Money value={row.original.d_61_90} moneda={row.original.moneda} danger={row.original.d_61_90 > 0} />,
      enableSorting: true, meta: { align: "right" },
    },
    {
      id: "mas_90",
      header: "+90 días",
      accessorKey: "mas_90",
      cell: ({ row }) => <Money value={row.original.mas_90} moneda={row.original.moneda} danger={row.original.mas_90 > 0} />,
      enableSorting: true, meta: { align: "right" },
    },
    {
      id: "saldo_total",
      header: "Total",
      accessorKey: "saldo_total",
      cell: ({ row }) => (
        <span className="tabular-nums font-semibold">
          {formatCurrency(row.original.saldo_total, row.original.moneda)} {row.original.moneda}
        </span>
      ),
      enableSorting: true, meta: { align: "right" },
    },
  ]);
}
