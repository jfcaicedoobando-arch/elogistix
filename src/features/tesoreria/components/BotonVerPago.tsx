/**
 * Botón "Ver pago" para renglones de movimientos bancarios (v13.463.0).
 *
 * Se muestra sólo cuando el movimiento está conciliado y guarda el pago con el
 * que quedó amarrado, para que un clic abra el detalle del pago y sus facturas
 * aplicadas sin pasos intermedios.
 */
import { Link2Off, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  refPagoDeMovimiento,
  type RefPago,
  type VinculosMovimiento,
} from "@/features/tesoreria/domain/pagoDetalle";

interface Props {
  movimiento: VinculosMovimiento & { estado_conciliacion?: string | null };
  onVerPago: (ref: RefPago) => void;
}

export function BotonVerPago({ movimiento, onVerPago }: Props) {
  const conciliado = movimiento.estado_conciliacion === "Conciliado";
  const ref = refPagoDeMovimiento(movimiento);

  if (!conciliado) return <span className="text-2xs text-muted-foreground">—</span>;

  if (!ref) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center text-muted-foreground">
            <Link2Off className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Conciliado sin pago vinculado</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>Conciliado sin pago vinculado</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-2xs"
      onClick={(e) => {
        e.stopPropagation();
        onVerPago(ref);
      }}
    >
      <Receipt className="h-3.5 w-3.5" aria-hidden />
      Ver pago
    </Button>
  );
}
