/**
 * Atajos de reparto del cobro en lote de cliente.
 * No cambian reglas de negocio: sólo pre-llenan los importes por factura.
 */
import { ListOrdered, CheckCheck, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onFifo: () => void;
  onLiquidarTodo: () => void;
  onLimpiar: () => void;
  disabled?: boolean;
}

export function DialogCobroLoteAcciones(p: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={p.onFifo}
        disabled={p.disabled}
        title="Reparte el importe recibido: primero lo que vence antes"
      >
        <ListOrdered className="mr-1.5 h-3.5 w-3.5" />
        Repartir FIFO
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={p.onLiquidarTodo}
        disabled={p.disabled}
        title="Asigna el saldo completo de cada factura"
      >
        <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
        Liquidar todo
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={p.onLimpiar}
        disabled={p.disabled}
        title="Deja todos los importes en cero"
      >
        <Eraser className="mr-1.5 h-3.5 w-3.5" />
        Limpiar reparto
      </Button>
    </div>
  );
}
