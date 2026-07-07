/**
 * Bandeja "Proformas listas": proformas aprobadas internamente y sin
 * factura asociada. Drilldown al detalle de la proforma, donde vive
 * el botón "Convertir a factura".
 */
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useProformasListas, type FilaProformaLista } from "@/features/facturacion/hooks/useProformasListas";

const columns = defineColumns<FilaProformaLista>([
  {
    id: "num",
    header: "Nº proforma",
    cell: ({ row }) => <span className="font-mono">{row.original.numero || "—"}</span>,
  },
  { id: "cli", header: "Cliente", accessorFn: (r) => r.cliente_nombre },
  {
    id: "exp",
    header: "Expediente",
    accessorFn: (r) => r.expediente ?? "—",
    cell: ({ row }) => row.original.expediente ?? "—",
  },
  {
    id: "tot",
    header: "Total",
    meta: { align: "right" },
    cell: ({ row }) => {
      const r = row.original;
      if (r.total_usd && r.total_usd > 0) return formatCurrency(r.total_usd, "USD");
      if (r.total_mxn && r.total_mxn > 0) return formatCurrency(r.total_mxn, "MXN");
      return "—";
    },
  },
  {
    id: "fe",
    header: "Aprobada",
    accessorFn: (r) => r.created_at,
    cell: ({ row }) => formatDate(row.original.created_at),
  },
]);

export function BandejaProformasListas() {
  const { data, isLoading } = useProformasListas();
  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      isLoading={isLoading}
      emptyMessage="No hay proformas aceptadas por el cliente pendientes de facturar. ✅"
      rowKey={(r) => r.id}
      getRowHref={(r) => `/proformas/${r.id}`}
      getRowAriaLabel={(r) => `Abrir proforma ${r.numero || r.id}`}
    />
  );
}
