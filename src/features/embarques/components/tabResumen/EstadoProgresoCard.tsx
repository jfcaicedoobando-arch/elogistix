import { Card, CardContent } from "@/components/ui/card";
import { ESTADOS_EMBARQUE } from "@/features/embarques/constants/embarqueConstants";

interface Props {
  currentStepIndex: number;
}

/**
 * Versión compacta del stepper para el detalle de embarque.
 * En FHD la variante original ocupaba ~130px verticales sólo para mostrar
 * "paso 2/8". Esta variante libera ~80px y mantiene toda la información.
 */
export function EstadoProgresoCard({ currentStepIndex }: Props) {
  const total = ESTADOS_EMBARQUE.length;
  const estadoActual = ESTADOS_EMBARQUE[currentStepIndex] ?? ESTADOS_EMBARQUE[0];
  const progreso = total > 1 ? (currentStepIndex / (total - 1)) * 100 : 0;
  const siguiente = ESTADOS_EMBARQUE[currentStepIndex + 1];

  return (
    <Card>
      <CardContent className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Paso {currentStepIndex + 1} de {total}
            </span>
            <span className="text-sm font-semibold truncate">{estadoActual}</span>
          </div>
          {siguiente && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Siguiente: <span className="text-foreground/80">{siguiente}</span>
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          {ESTADOS_EMBARQUE.map((estado, i) => (
            <div
              key={estado}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= currentStepIndex ? "bg-accent" : "bg-muted"
              }`}
              title={estado}
              aria-label={estado}
            />
          ))}
        </div>

        {/* Fallback accesible: barra continua */}
        <div className="sr-only" role="progressbar" aria-valuenow={progreso} aria-valuemin={0} aria-valuemax={100}>
          {estadoActual} — {Math.round(progreso)}%
        </div>
      </CardContent>
    </Card>
  );
}
