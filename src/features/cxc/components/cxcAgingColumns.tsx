/**
 * Columnas del aging de CxC: una fila por cliente con saldo desglosado por
 * antigüedad. Row-click navega a `/cartera?cliente=...` desde el consumer.
 */
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CxcAgingRow } from "@/features/cxc/services/cxcAging";

function Money({ value, moneda, danger }: { value: number; moneda: string; danger?: boolean }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("tabular-nums", danger && "text-destructive font-medium")}>
      {formatCurrency(value, moneda)}
    </span>
  );
}

/** `moneda` sólo formatea: las filas ya vienen filtradas por moneda. */
export function buildCxcAgingColumns(moneda = "MXN"): ColumnDef<CxcAgingRow, unknown>[] {
  return defineColumns<CxcAgingRow>([
    {
      id: "cliente",
      header: "Cliente",
      accessorKey: "cliente_nombre",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.cliente_nombre}</span>
      ),
      enableSorting: true,
    },
    {
      id: "num_facturas",
      header: "Facturas",
      accessorKey: "num_facturas",
      cell: ({ row }) => <span className="tabular-nums">{row.original.num_facturas}</span>,
      enableSorting: true,
      meta: { align: "right" },
    },
    {
      id: "vigente",
      header: "Vigente",
      accessorKey: "vigente",
      cell: ({ row }) => <Money moneda={moneda} value={row.original.vigente} />,
      enableSorting: true,
      meta: { align: "right" },
    },
    {
      id: "d_1_30",
      header: "1-30 días",
      accessorKey: "d_1_30",
      cell: ({ row }) => <Money moneda={moneda} value={row.original.d_1_30} danger={row.original.d_1_30 > 0} />,
      enableSorting: true,
      meta: { align: "right" },
    },
    {
      id: "d_31_60",
      header: "31-60 días",
      accessorKey: "d_31_60",
      cell: ({ row }) => <Money moneda={moneda} value={row.original.d_31_60} danger={row.original.d_31_60 > 0} />,
      enableSorting: true,
      meta: { align: "right" },
    },
    {
      id: "d_61_90",
      header: "61-90 días",
      accessorKey: "d_61_90",
      cell: ({ row }) => <Money moneda={moneda} value={row.original.d_61_90} danger={row.original.d_61_90 > 0} />,
      enableSorting: true,
      meta: { align: "right" },
    },
    {
      id: "mas_90",
      header: ">90 días",
      accessorKey: "mas_90",
      cell: ({ row }) => <Money moneda={moneda} value={row.original.mas_90} danger={row.original.mas_90 > 0} />,
      enableSorting: true,
      meta: { align: "right" },
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
      enableSorting: true,
      meta: { align: "right" },
    },
  ]);
}
