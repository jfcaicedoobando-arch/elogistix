/**
 * Sub-componentes presentacionales del detalle de factura CxP.
 * FacturaToolbar quedó reemplazado por StatusActionBar (.actionbar.tsx);
 * este archivo mantiene FacturaResumen (KPIs) y PagosTable.
 */
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { formatCurrency } from "@/lib/formatters";
import { Kpi, HeaderWithTooltip } from "./DialogDetallePagosProveedor.parts";
import { PagoFila, type PagoRow } from "./DialogDetallePagosProveedor.fila";
import type { FacturaCxP } from "@/features/cxp/services";

/** Grilla de KPIs con énfasis contextual (Saldo si hay saldo, Pagado si liquidada). */
export function PagosTable({ pagos, isLoading, canEdit, onEliminarPago }: PagosTableProps) {
  if (isLoading) return <ListSkeleton rows={3} />;
  if (pagos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No hay pagos registrados para esta factura.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-label uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3 font-bold">Fecha</th>
            <th className="text-left px-4 py-3 font-bold">Método</th>
            <th className="text-right px-4 py-3 font-bold">Monto</th>
            <th className="text-right px-4 py-3 font-bold">
              <HeaderWithTooltip label="TC Pago" hint="Tipo de cambio USD→MXN registrado al momento de aplicar el pago." />
            </th>
            <th className="text-right px-4 py-3 font-bold">
              <HeaderWithTooltip label="Dif. Cambio" hint="Diferencia cambiaria en MXN (ganancia o pérdida) entre la tasa de la factura y la tasa del pago." />
            </th>
            <th className="text-left px-4 py-3 font-bold">Banco</th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {pagos.map((p) => (
            <PagoFila key={p.id} pago={p} canEdit={canEdit} onEliminar={onEliminarPago} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
