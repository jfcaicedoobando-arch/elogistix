/** Columnas del detalle de Aging CxC; consumen los días ya clasificados por el reporte. */
import { defineColumns } from "@/components/shared/DataTable";
import { ToneBadge } from "@/components/shared/ToneBadge";
import type { FacturaCobranza } from "@/features/facturacion/services/cobranza";
import { bucketDeDias, CUBETA_LABELS, CUBETA_TONE } from "@/lib/aging/buckets";
import { formatCurrency, formatDate } from "@/lib/formatters";

export function buildCxcAgingDrillDownColumns() {
  return defineColumns<FacturaCobranza>([
    {
      id: "numero",
      header: "Factura",
      accessorKey: "numero",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium">{row.original.numero}</span>
      ),
    },
    {
      id: "expediente",
      header: "Expediente",
      accessorKey: "expediente",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.expediente || "-"}</span>
      ),
    },
    {
      id: "fecha_emision",
      header: "Emisión",
      accessorKey: "fecha_emision",
      cell: ({ row }) => <span className="text-xs">{formatDate(row.original.fecha_emision)}</span>,
    },
    {
      id: "fecha_vencimiento",
      header: "Vence",
      accessorKey: "fecha_vencimiento",
      cell: ({ row }) => (
        <span className="text-xs">{formatDate(row.original.fecha_vencimiento)}</span>
      ),
    },
    {
      id: "cubeta",
      header: "Antigüedad",
      cell: ({ row }) => {
        const b = bucketDeDias(row.original.dias_vencido);
        return <ToneBadge tone={CUBETA_TONE[b]}>{CUBETA_LABELS[b]}</ToneBadge>;
      },
    },
    {
      id: "saldo",
      header: "Saldo",
      accessorKey: "saldo",
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {formatCurrency(row.original.saldo, row.original.moneda)}
        </span>
      ),
      meta: { align: "right" },
    },
  ]);
}
