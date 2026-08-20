/**
 * Atajos de reparto del cobro en lote de cliente.
 * No cambian reglas de negocio: sólo pre-llenan los importes por factura.
 */
import { ListOrdered, CheckCheck, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";

interface Props {
  onFifo: () => void;
  onLiquidarTodo: () => void;
  onLimpiar: () => void;
  disabled?: boolean;
}

export function DialogCobroLoteAcciones(p: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Hint label="Reparte el importe recibido: primero lo que vence antes">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={p.onFifo}
          disabled={p.disabled}
        >
          <ListOrdered className="mr-1.5 h-3.5 w-3.5" />
          Repartir FIFO
        </Button>
      </Hint>
      <Hint label="Asigna el saldo completo de cada factura">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={p.onLiquidarTodo}
          disabled={p.disabled}
        >
          <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
          Liquidar todo
        </Button>
      </Hint>
      <Hint label="Deja todos los importes en cero">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={p.onLimpiar}
          disabled={p.disabled}
        >
          <Eraser className="mr-1.5 h-3.5 w-3.5" />
          Limpiar reparto
        </Button>
      </Hint>
    </div>
  );
}
