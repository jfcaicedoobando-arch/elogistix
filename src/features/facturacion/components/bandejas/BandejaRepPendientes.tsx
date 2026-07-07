/**
 * Bandeja "REP pendientes": pagos aplicados a facturas PPD cuyo
 * Complemento de Pagos (REP) no se ha timbrado (estado_rep en
 * 'Pendiente' o 'Error'). Drilldown al detalle de la factura padre.
 */
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { usePagosRepPendientes, type FilaRepPendiente } from "@/features/facturacion/hooks/useBandejas";

function badgeTone(estado: string): "outline" | "destructive" {
  return estado === "Error" ? "destructive" : "outline";
}

const columns = defineColumns<FilaRepPendiente>([
  {
    id: "fol",
    header: "Factura",
    cell: ({ row }) => <span className="font-mono">{row.original.factura_numero}</span>,
  },
  { id: "cli", header: "Cliente", accessorFn: (r) => r.cliente_nombre },
  {
    id: "fp",
    header: "Fecha pago",
    accessorFn: (r) => r.fecha_pago,
    cell: ({ row }) => formatDate(row.original.fecha_pago),
  },
  {
    id: "mon",
    header: "Monto",
    meta: { align: "right" },
    accessorFn: (r) => r.monto,
    cell: ({ row }) => formatCurrency(row.original.monto, row.original.moneda),
  },
  {
    id: "est",
    header: "Estado REP",
    accessorFn: (r) => r.estado_rep,
    cell: ({ row }) => <Badge variant={badgeTone(row.original.estado_rep)}>{row.original.estado_rep}</Badge>,
  },
]);

export function BandejaRepPendientes() {
  const { data, isLoading } = usePagosRepPendientes();
  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      isLoading={isLoading}
      emptyMessage="No hay complementos de pago pendientes. ✅"
      rowKey={(r) => r.id}
      getRowHref={(r) => `/facturacion/${r.factura_id}`}
      getRowAriaLabel={(r) => `Abrir factura ${r.factura_numero}`}
    />
  );
}
