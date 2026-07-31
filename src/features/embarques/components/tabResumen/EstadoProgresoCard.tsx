import { Card, CardContent } from "@/components/ui/card";
import { FasesEmbarqueStepper } from "../tracking/FasesEmbarqueStepper";
import type { EmbarqueFasesInput } from "@/features/embarques/domain/embarqueFases";

interface Props {
  embarque: EmbarqueFasesInput;
  cotizacionCreatedAt?: string | null;
  arribado?: boolean;
}

/**
 * Avance del embarque en el tab Resumen: misma fuente de verdad y mismo
 * lenguaje visual que el tab Tracking, en densidad compacta (≈50px de alto).
 */
export function EstadoProgresoCard({ embarque, cotizacionCreatedAt, arribado = false }: Props) {
  return (
    <Card data-testid="estado-progreso" data-arrived={arribado ? "true" : "false"}>
      <CardContent className="px-4 py-3">
        <FasesEmbarqueStepper
          embarque={embarque}
          cotizacionCreatedAt={cotizacionCreatedAt}
          variant="compacta"
        />
      </CardContent>
    </Card>
  );
}
