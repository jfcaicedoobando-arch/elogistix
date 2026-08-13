/**
 * ConsultaRepsTable — verificación XML + SAT de cada REP (complemento de pago)
 * timbrado de la factura, incluidos los ya cancelados.
 */
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatDateMx } from "@/lib/formatters/dates";
import type { ConsultarFacturapiRep } from "@/features/facturacion/services/facturapi";
import { ConsultaSatBadge } from "./ConsultaSatBadge";

function estadoLocal(rep: ConsultarFacturapiRep): string {
  const cs = (rep.rep_cancellation_status ?? "none").toLowerCase();
  if (cs === "accepted") return "Cancelado";
  if (cs === "pending" || cs === "verifying") return "En cancelación";
  return rep.estado_rep ?? "—";
}

export function ConsultaRepsTable({ reps }: { reps: ConsultarFacturapiRep[] | undefined }) {
  if (!reps || reps.length === 0) return null;
  return (
    <div className="rounded-lg border">
      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase border-b">
        XML de los REP timbrados ({reps.length})
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead>En Libre Carga</TableHead>
            <TableHead>SAT</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reps.map((rep) => (
            <TableRow key={rep.pago_id}>
              <TableCell>
                <div className="font-medium">{rep.folio ?? "—"}</div>
                {rep.uuid && (
                  <div className="font-mono text-[11px] text-muted-foreground">{rep.uuid}</div>
                )}
              </TableCell>
              <TableCell>{rep.fecha_pago ? formatDateMx(rep.fecha_pago) : "—"}</TableCell>
              <TableCell className="text-right">
                {rep.monto == null ? "—" : formatCurrency(rep.monto, rep.moneda ?? "MXN")}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{estadoLocal(rep)}</Badge>
                  {rep.reconciliado && <Badge variant="secondary">Reconciliado</Badge>}
                </div>
              </TableCell>
              <TableCell>
                <ConsultaSatBadge estatus={rep.estatus_sat} />
                {rep.error && <div className="text-[11px] text-destructive mt-1">{rep.error}</div>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
