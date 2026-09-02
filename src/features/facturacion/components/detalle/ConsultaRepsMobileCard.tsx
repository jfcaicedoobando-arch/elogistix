/**
 * Tarjeta móvil de verificación XML + SAT de un REP.
 * Extraída al migrar `ConsultaRepsTable` a `ResponsiveDataTable`.
 */
import { Badge } from "@/components/ui/badge";
import { MoneyCell } from "@/components/shared/MoneyCell";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters/dates";
import type { ConsultarFacturapiRep } from "@/features/facturacion/services/facturapi";
import { ConsultaSatBadge } from "./ConsultaSatBadge";

function estadoLocal(rep: ConsultarFacturapiRep): string {
  const cs = (rep.rep_cancellation_status ?? "none").toLowerCase();
  if (cs === "accepted") return "Cancelado";
  if (cs === "pending" || cs === "verifying") return "En cancelación";
  return rep.estado_rep ?? "—";
}

export function ConsultaRepsMobileCard({ row: rep }: { row: ConsultarFacturapiRep }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="font-semibold text-body">{rep.folio ?? "—"}</div>
          {rep.uuid && <div className="font-mono text-label text-muted-foreground truncate">{rep.uuid}</div>}
          <div className="text-body-sm text-muted-foreground">
            {rep.fecha_pago ? formatDate(rep.fecha_pago) : "—"}
          </div>
        </div>
        <MoneyCell
          label="Monto"
          value={rep.monto == null ? "—" : formatCurrency(rep.monto, rep.moneda ?? "MXN")}
          className="shrink-0 max-w-[48%]"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant="outline">{estadoLocal(rep)}</Badge>
        {rep.reconciliado && <Badge variant="secondary">Reconciliado</Badge>}
        <ConsultaSatBadge estatus={rep.estatus_sat} />
      </div>
      {rep.error && <div className="text-label text-destructive">{rep.error}</div>}
    </div>
  );
}
