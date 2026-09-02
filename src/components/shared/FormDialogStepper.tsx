/**
 * Stepper visual reutilizable para wizards dentro de modales (2-4 pasos).
 * Renderiza una barra segmentada con el número del paso activo destacado.
 * Visual: barritas redondeadas con color primario en el paso actual y los previos.
 */
import { cn } from "@/lib/utils";

interface Props {
  step: number;
  totalSteps: number;
  labels?: string[];
  className?: string;
}

export function FormDialogStepper({ step, totalSteps, labels, className }: Props) {
  return (
    <div className={cn("flex items-center gap-2", className)} aria-label={`Paso ${step} de ${totalSteps}`}>
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const idx = i + 1;
          const done = idx < step;
          const active = idx === step;
          return (
            <div
              key={idx}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                done && "bg-primary/70",
                active && "bg-primary",
                !done && !active && "bg-muted",
              )}
            />
          );
        })}
      </div>
      <span className="text-overline font-medium shrink-0">
        Paso {step} de {totalSteps}
        {labels?.[step - 1] && <span className="ml-1 normal-case text-foreground/70">· {labels[step - 1]}</span>}
      </span>

    </div>
  );
}
