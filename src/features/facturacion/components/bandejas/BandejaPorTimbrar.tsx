/**
 * Bandeja "Por timbrar": borradores creados en el sistema
 * (post 01/07/2026) que aún no se han enviado a FacturApi.
 * Drilldown de fila al detalle del CFDI.
 */
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useFacturasPorTimbrar, type FilaPorTimbrar } from "@/features/facturacion/hooks/useBandejas";

const columns = defineColumns<FilaPorTimbrar>([
  {
    id: "num",
    header: "Folio interno",
    cell: ({ row }) => (
      <span className="font-mono">
        {row.original.numero.startsWith("BORRADOR-") ? "Sin folio" : row.original.numero}
      </span>
    ),
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

export function BandejaPorTimbrar() {
  const { data, isLoading } = useFacturasPorTimbrar();
  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      isLoading={isLoading}
      emptyMessage="No hay facturas pendientes de timbrar. ✅"
      rowKey={(r) => r.id}
      getRowHref={(r) => `/facturacion/${r.id}`}
      getRowAriaLabel={(r) => `Abrir factura ${r.numero}`}
    />
  );
}
