import { CalendarCheck, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <CalendarCheck className="h-4 w-4 mr-2" />
        Programar pago ({selectedCount})
      </Button>
      <Button
        onClick={onPagarLote}
        disabled={!loteDisponible}
        title={
          loteDisponible
            ? undefined
            : "Selecciona 2 o más facturas del mismo proveedor y la misma moneda"
        }
      >
        <Layers className="h-4 w-4 mr-2" />
        Pagar en lote ({selectedCount})
      </Button>
    </div>
  );
}
