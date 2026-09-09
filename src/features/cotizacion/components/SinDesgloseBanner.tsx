import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface Props {
  /** Acción opcional para abrir el paso/sección de costos. */
  onCargarCostos?: () => void;
  className?: string;
}

/**
 * Banner persistente para cotizaciones creadas sin desglose de costos.
 * Se muestra en Paso 3/4 del wizard y en el detalle de cotización.
 *
 * R257: usa el callout canónico `Alert variant="warning"` (guardia
 * `no-raw-callout`) en lugar del borde/fondo tintados a mano.
 */
export function SinDesgloseBanner({ onCargarCostos, className }: Props) {
  return (
    <Alert variant="warning" className={className}>
      <AlertTriangle className="size-4" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <AlertTitle className="text-body">Cotización sin desglose de costos</AlertTitle>
          <AlertDescription className="text-body-sm text-muted-foreground">
            Esta cotización se creó sin cargar costos internos. Debes cargar costos
            antes de convertirla en embarque.
          </AlertDescription>
        </div>
        {onCargarCostos && (
          <Button size="sm" variant="outline" onClick={onCargarCostos} className="flex-shrink-0">
            Cargar costos
          </Button>
        )}
      </div>
    </Alert>
  );
}
