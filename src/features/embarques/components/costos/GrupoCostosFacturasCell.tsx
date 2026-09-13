/**
 * Celda "Factura(s)" del grupo de costos por proveedor.
 * Extraída de `GrupoCostosProveedor.tsx` (Power-of-10: ≤200 líneas).
 * Sin cambios de comportamiento.
 */
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/formatters";
import type { FilaReconciliacion } from "@/features/embarques/services/reconciliacionCostos";
import { fmtFecha } from "./grupoCostosProveedorHelpers";

interface Props {
  fila: FilaReconciliacion;
}

export function GrupoCostosFacturasCell({ fila }: Props) {
  if (fila.facturas.length === 0) {
    return <span className="text-muted-foreground text-body-sm">Sin factura</span>;
  }
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-1">
        {fila.facturas.map(fa => (
          <Tooltip key={fa.proveedor_factura_id}>
            <TooltipTrigger asChild>
              <Link
                to={`/compras/facturas/${fa.proveedor_factura_id}`}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Abrir factura ${fa.folio_interno ?? fa.folio_proveedor}`}
                className="w-fit"
              >
                <Badge variant="outline" className="w-fit gap-1 font-normal text-body-sm hover:bg-muted">
                  <FileText className="h-3 w-3" />
                  {fa.folio_interno ?? fa.folio_proveedor} · {fmtFecha(fa.fecha_emision)}
                </Badge>
              </Link>
            </TooltipTrigger>
            <TooltipContent className="text-body-sm">
              <div className="font-medium">{fa.folio_interno ?? fa.folio_proveedor}</div>
              <div>Folio proveedor: {fa.folio_proveedor}</div>
              <div>Monto: {formatCurrency(fa.monto, fila.moneda)}</div>
              <div>Emisión: {fmtFecha(fa.fecha_emision)}</div>
              {fa.fecha_vencimiento && <div>Vencimiento: {fmtFecha(fa.fecha_vencimiento)}</div>}
              {fa.estatus_pago && <div>Pago: {fa.estatus_pago}</div>}
              {fa.descripcion && <div className="text-muted-foreground max-w-xs">{fa.descripcion}</div>}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
