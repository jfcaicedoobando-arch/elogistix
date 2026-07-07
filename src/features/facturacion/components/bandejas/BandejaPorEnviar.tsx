/**
 * Bandeja "Por enviar": CFDI ya timbrados que aún no se han
 * mandado por correo al cliente. Drilldown de fila al detalle.
 */
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useFacturasPorEnviar, type FilaPorEnviar } from "@/features/facturacion/hooks/useBandejas";

const columns = defineColumns<FilaPorEnviar>([
  {
    id: "num",
    header: "Folio",
    cell: ({ row }) => <span className="font-mono">{row.original.numero}</span>,
  },
  { id: "cli", header: "Cliente", accessorFn: (r) => r.cliente_nombre },
  {
    id: "fe",
    header: "Emisión",
    accessorFn: (r) => r.fecha_emision,
    cell: ({ row }) => formatDate(row.original.fecha_emision),
  },
  {
    id: "tot",
    header: "Total",
    meta: { align: "right" },
    accessorFn: (r) => r.total,
    cell: ({ row }) => formatCurrency(row.original.total, row.original.moneda),
  },
]);

export function BandejaPorEnviar() {
  const { data, isLoading } = useFacturasPorEnviar();
  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      isLoading={isLoading}
      emptyMessage="Todos los CFDI timbrados ya se enviaron. ✅"
      rowKey={(r) => r.id}
      getRowHref={(r) => `/facturacion/${r.id}`}
      getRowAriaLabel={(r) => `Abrir factura ${r.numero}`}
    />
  );
}
