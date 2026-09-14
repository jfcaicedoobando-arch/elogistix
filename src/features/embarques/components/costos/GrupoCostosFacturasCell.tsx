/**
 * Celda "Factura(s)" del grupo de costos por proveedor.
 * Extraída de `GrupoCostosProveedor.tsx` (Power-of-10: ≤200 líneas).
 *
 * B1 (v13.823.394): los roles operativos (coordinador logístico, gerente de
 * operaciones) ven el folio y el detalle de la factura vinculada, pero NO el
 * enlace al módulo de CxP (`/compras/facturas/:id`) porque esa ruta les está
 * negada. Sólo `canViewFinancials` conserva el enlace.
 */
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { formatCurrency } from "@/lib/formatters";
import type { FilaReconciliacion } from "@/features/embarques/services/reconciliacionCostos";
import { fmtFecha } from "./grupoCostosProveedorHelpers";

interface Props {
  fila: FilaReconciliacion;
}

type FacturaFila = FilaReconciliacion["facturas"][number];

function EtiquetaFactura({ fa, fecha }: { fa: FacturaFila; fecha: string }) {
  return (
    <Badge variant="outline" className="w-fit gap-1 font-normal text-body-sm hover:bg-muted">
      <FileText className="size-3" />
      {fa.folio_interno ?? fa.folio_proveedor} · {fecha}
    </Badge>
  );
}

export function GrupoCostosFacturasCell({ fila }: Props) {
  const { canViewFinancials } = usePermissions();

  if (fila.facturas.length === 0) {
    return <span className="text-muted-foreground text-body-sm">Sin factura</span>;
  }
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-1">
        {fila.facturas.map(fa => {
          const folio = fa.folio_interno ?? fa.folio_proveedor;
          const fecha = fmtFecha(fa.fecha_emision);
          return (
            <Tooltip key={fa.proveedor_factura_id}>
              <TooltipTrigger asChild>
                {canViewFinancials ? (
                  <Link
                    to={`/compras/facturas/${fa.proveedor_factura_id}`}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Abrir factura ${folio}`}
                    className="w-fit"
                  >
                    <EtiquetaFactura fa={fa} fecha={fecha} />
                  </Link>
                ) : (
                  <span className="w-fit" tabIndex={0} aria-label={`Factura ${folio}`}>
                    <EtiquetaFactura fa={fa} fecha={fecha} />
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent className="text-body-sm">
                <div className="font-medium">{folio}</div>
                <div>Folio proveedor: {fa.folio_proveedor}</div>
                <div>Monto: {formatCurrency(fa.monto, fila.moneda)}</div>
                <div>Emisión: {fecha}</div>
                {fa.fecha_vencimiento && <div>Vencimiento: {fmtFecha(fa.fecha_vencimiento)}</div>}
                {fa.estatus_pago && <div>Pago: {fa.estatus_pago}</div>}
                {fa.descripcion && <div className="text-muted-foreground max-w-xs">{fa.descripcion}</div>}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

