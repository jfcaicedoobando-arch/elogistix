import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Acción opcional para abrir el paso/sección de costos. */
  onCargarCostos?: () => void;
  className?: string;
}

/**
 * Banner persistente para cotizaciones creadas sin desglose de costos.
 * Se muestra en Paso 3/4 del wizard y en el detalle de cotización.
 */
export function SinDesgloseBanner({ onCargarCostos, className }: Props) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3 rounded-md border border-warning/40 bg-warning/10 [color:hsl(var(--warning-foreground,var(--foreground)))] ${className ?? ""}`}
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Cotización sin desglose de costos</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Esta cotización se creó sin cargar costos internos. Debes cargar costos
          antes de convertirla en embarque.
        </p>
      </div>
      {onCargarCostos && (
        <Button size="sm" variant="outline" onClick={onCargarCostos} className="flex-shrink-0">
          Cargar costos
        </Button>
      )}
    </div>
  );
}
