import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import type { FilaReconciliacion } from "@/features/embarques/services/reconciliacionCostos";
import { AjusteChip } from "./AjusteChip";
import { describirAjuste } from "./ajusteDescripcion";
import { GrupoCostosFacturasCell } from "./GrupoCostosFacturasCell";
import { estatusBadgeClass, estatusLabel, pagoBadgeClass, peorEstadoPago } from "./grupoCostosProveedorHelpers";

interface Props {
  filas: FilaReconciliacion[];
  showContenedorCol?: boolean;
  renderContenedor?: (id: string | null | undefined) => React.ReactNode;
  filaContenedorId?: (fila: FilaReconciliacion) => string | null | undefined;
}

export function GrupoCostosMobileRows({
  filas, showContenedorCol, renderContenedor, filaContenedorId,
}: Props) {
  return (
    <ul className="divide-y md:hidden">
      {filas.map((fila) => {
        const pago = peorEstadoPago(fila.facturas);
        const ajuste = describirAjuste(fila.cotizado, fila.real_facturado, fila.moneda, {
          tieneFactura: fila.facturas.length > 0,
        });
        const contenedor = renderContenedor && filaContenedorId
          ? renderContenedor(filaContenedorId(fila))
          : "General";
        return (
          <li key={fila.concepto_costo_id} className="space-y-2 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-body break-words">{fila.concepto}</p>
              <Badge variant="outline" className={`${estatusBadgeClass(fila.estatus_renglon)} shrink-0 text-body-sm`}>
                {estatusLabel(fila.estatus_renglon)}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-body-sm">
              <div>
                <span className="block text-label text-muted-foreground">Cotizado</span>
                <span className="font-medium tabular-nums">{formatCurrency(fila.cotizado, fila.moneda)}</span>
              </div>
              <div>
                <span className="block text-label text-muted-foreground">Facturado</span>
                {fila.real_facturado > 0
                  ? <span className="font-medium tabular-nums">{formatCurrency(fila.real_facturado, fila.moneda)}</span>
                  : <span className="text-muted-foreground">—</span>}
              </div>
              <div className="space-y-1">
                <span className="block text-label text-muted-foreground">Ajuste</span>
                <AjusteChip descripcion={ajuste} />
              </div>
              <div className="space-y-1">
                <span className="block text-label text-muted-foreground">Pago</span>
                {pago ? <Badge variant="outline" className={pagoBadgeClass(pago)}>{pago}</Badge> : <span className="text-muted-foreground">—</span>}
              </div>
              <div className="col-span-2 space-y-1">
                <span className="block text-label text-muted-foreground">Factura(s)</span>
                <GrupoCostosFacturasCell fila={fila} />
              </div>
              {showContenedorCol && (
                <div className="col-span-2 space-y-1">
                  <span className="block text-label text-muted-foreground">Contenedor</span>
                  <div className="text-body-sm">{contenedor || "General"}</div>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}