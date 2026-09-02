import { CalendarCheck, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";

interface Props {
  visible: boolean;
  selectedCount: number;
  loteDisponible: boolean;
  onProgramar: () => void;
  onPagarLote: () => void;
}

/**
 * Acciones del encabezado de CxP Por Pagar (programar / pagar en lote).
 * Extraído de `CxpPorPagar` (Power of 10: archivos ≤200 líneas).
 */
export function CxpPorPagarHeaderActions({
  visible,
  selectedCount,
  loteDisponible,
  onProgramar,
  onPagarLote,
}: Props) {
  if (!visible) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onProgramar} variant="outline">
        <CalendarCheck className="size-4 mr-2" />
        Programar pago ({selectedCount})
      </Button>
      <Hint
        label={
          loteDisponible
            ? undefined
            : "Selecciona 2 o más facturas del mismo proveedor y la misma moneda"
        }
      >
        <span>
          <Button onClick={onPagarLote} disabled={!loteDisponible}>
            <Layers className="size-4 mr-2" />
            Pagar en lote ({selectedCount})
          </Button>
        </span>
      </Hint>
    </div>
  );
}
