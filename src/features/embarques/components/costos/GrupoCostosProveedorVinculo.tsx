/**
 * P1-2 — Aviso de costo con proveedor en texto libre (sin vínculo al catálogo).
 *
 * Al convertir una cotización el costo guarda sólo `proveedor_nombre`, nunca el
 * UUID del catálogo. Esos costos se veían "con proveedor" en Costos, pero el
 * checklist de cierre los reportaba como "sin proveedor asignado" y el buzón de
 * facturas no ofrecía al proveedor. Aquí se distingue el estado y se ofrece la
 * ruta existente para vincularlo de forma explícita (nunca automática).
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link2, ExternalLink } from "lucide-react";
import { ROUTES } from "@/constants/routes";

interface Props {
  /** Nombre libre del grupo (tal como se capturó en la cotización). */
  proveedorNombre: string;
  /** Acción existente para editar los costos y elegir el proveedor del catálogo. */
  onVincular?: () => void;
}

export function GrupoCostosProveedorVinculo({ proveedorNombre, onVincular }: Props) {
  return (
    <div
      data-testid="costos-proveedor-sin-vinculo"
      className="flex flex-wrap items-center gap-2 border-t bg-warning/5 px-3 py-2 text-body-sm"
    >
      <Badge variant="outline" className="border-warning text-warning shrink-0">
        Nombre sin vincular al catálogo
      </Badge>
      <span className="text-muted-foreground min-w-0">
        «{proveedorNombre}» es sólo un nombre capturado en la cotización. Vincúlalo
        al proveedor del catálogo antes de subir su factura.
      </span>
      {onVincular && (
        <Button size="sm" variant="outline" className="h-7 px-2" onClick={onVincular}>
          <Link2 className="mr-1 h-3 w-3" /> Vincular proveedor
        </Button>
      )}
      <a
        href={ROUTES.COMPRAS_PROVEEDORES}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
      >
        Dar de alta en Compras › Proveedores <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
