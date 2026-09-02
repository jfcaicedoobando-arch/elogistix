/**
 * ConsultaRepsTable — verificación XML + SAT de cada REP (complemento de pago)
 * timbrado de la factura, incluidos los ya cancelados.
 */
import { Badge } from "@/components/ui/badge";
import { defineColumns } from "@/components/shared/DataTable";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters/dates";
import type { ConsultarFacturapiRep } from "@/features/facturacion/services/facturapi";
import { ConsultaSatBadge } from "./ConsultaSatBadge";
import { ConsultaRepsMobileCard } from "./ConsultaRepsMobileCard";

function estadoLocal(rep: ConsultarFacturapiRep): string {
  const cs = (rep.rep_cancellation_status ?? "none").toLowerCase();
  if (cs === "accepted") return "Cancelado";
  if (cs === "pending" || cs === "verifying") return "En cancelación";
  return rep.estado_rep ?? "—";
}

const columnas = defineColumns<ConsultarFacturapiRep>([
  {
    id: "folio",
    header: "Folio",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.folio ?? "—"}</div>
        {row.original.uuid && (
          <div className="font-mono text-label text-muted-foreground">{row.original.uuid}</div>
        )}
      </div>
    ),
  },
  {
    id: "fecha",
    header: "Fecha",
    cell: ({ row }) => (row.original.fecha_pago ? formatDate(row.original.fecha_pago) : "—"),
  },
  {
    id: "monto",
    header: "Monto",
    meta: { align: "right" },
    cell: ({ row }) =>
      row.original.monto == null
        ? "—"
        : formatCurrency(row.original.monto, row.original.moneda ?? "MXN"),
  },
  {
    id: "local",
    header: "En Libre Carga",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline">{estadoLocal(row.original)}</Badge>
        {row.original.reconciliado && <Badge variant="secondary">Reconciliado</Badge>}
      </div>
    ),
  },
  {
    id: "sat",
    header: "SAT",
    cell: ({ row }) => (
      <div>
        <ConsultaSatBadge estatus={row.original.estatus_sat} />
        {row.original.error && (
          <div className="text-label text-destructive mt-1">{row.original.error}</div>
        )}
      </div>
    ),
  },
]);

export function ConsultaRepsTable({ reps }: { reps: ConsultarFacturapiRep[] | undefined }) {
  if (!reps || reps.length === 0) return null;
  return (
    <div className="rounded-lg border">
      <div className="px-3 py-2 text-body-sm font-semibold text-muted-foreground uppercase border-b">
        XML de los REP timbrados ({reps.length})
      </div>
      <ResponsiveDataTable
        columns={columnas}
        data={reps}
        rowKey={(rep) => rep.pago_id}
        density={TABLE_DENSITY.embebida}
        tableClassName="w-full"
        mobileCard={(row) => <ConsultaRepsMobileCard row={row} />}
      />
    </div>
  );
}
