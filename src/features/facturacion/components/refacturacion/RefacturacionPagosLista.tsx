/**
 * Pagos involucrados en el caso: original dado de baja y el reasignado.
 */
import { formatCurrency, formatFechaEs } from "@/lib/formatters";
import type { RefacturacionPagoResumen } from "@/features/facturacion/services/refacturacionExpediente";

function estadoRep(p: RefacturacionPagoResumen): string {
  if (!p.uuid_rep) return "sin REP";
  return p.rep_cancelado_en ? "REP cancelado" : "REP vigente";
}

export function RefacturacionPagosLista({ pagos }: { pagos: RefacturacionPagoResumen[] }) {
  if (pagos.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-body-sm text-muted-foreground">Pagos involucrados</p>
      <ul className="space-y-1">
        {pagos.map((p) => (
          <li key={p.id} className="rounded-md border p-2 text-body-sm">
            <span className="font-medium">{formatCurrency(Number(p.monto), p.moneda)}</span>
            {" · "}{formatFechaEs(p.fecha_pago)}
            {" · "}{p.es_nuevo ? "aplicado a la factura nueva" : "pago original"}
            {p.deleted_at ? " · dado de baja" : ""}
            {" · "}{estadoRep(p)}
            {p.ordenante_nombre ? ` · pagó ${p.ordenante_nombre}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
