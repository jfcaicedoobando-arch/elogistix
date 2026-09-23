import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import type { FilaReconciliacion } from "@/features/embarques/services/reconciliacionCostos";
import { GrupoCostosFacturasCell } from "./GrupoCostosFacturasCell";
import { estatusLabel, pagoBadgeClass, peorEstadoPago } from "./grupoCostosProveedorHelpers";

export function GrupoCostosMobileRows({ filas }: { filas: FilaReconciliacion[] }) {
  return (
    <ul className="divide-y md:hidden">
      {filas.map((fila) => {
        const pago = peorEstadoPago(fila.facturas);
        return (
          <li key={fila.concepto_costo_id} className="space-y-2 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-body break-words">{fila.concepto}</p>
              <p className="shrink-0 font-semibold tabular-nums">{formatCurrency(fila.real_facturado || fila.cotizado, fila.moneda)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-body-sm">
              <div><span className="text-label text-muted-foreground">Factura(s)</span><GrupoCostosFacturasCell fila={fila} /></div>
              <div className="space-y-1"><span className="block text-label text-muted-foreground">Estado · Pago</span><Badge variant="outline">{estatusLabel(fila.estatus_renglon)}</Badge>{pago ? <Badge variant="outline" className={`ml-1 ${pagoBadgeClass(pago)}`}>{pago}</Badge> : null}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}