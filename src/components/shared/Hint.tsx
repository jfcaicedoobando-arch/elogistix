import type { ReactElement, ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HintProps {
  /** Texto de ayuda. Si viene vacío, se renderiza el hijo sin tooltip. */
  label?: ReactNode;
  /** Elemento disparador (debe aceptar ref: elemento nativo, Button, Badge…). */
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  /** Retardo antes de mostrar el tooltip (ms). */
  delayDuration?: number;
  className?: string;
}

/**
 * Reemplazo accesible del atributo nativo `title=` (Ola de accesibilidad).
 *
 * `title` nativo no es accesible: no aparece en móvil, no se puede leer con
 * teclado en muchos navegadores y los lectores de pantalla lo duplican o lo
 * ignoran. `Hint` usa el Tooltip de Radix (visible con foco de teclado y
 * hover) y mantiene el nombre accesible en el propio elemento vía
 * `aria-label` cuando es un control sin texto visible.
 *
 * ```tsx
 * <Hint label="Descargar PDF">
 *   <Button size="icon" aria-label="Descargar PDF"><Download /></Button>
 * </Hint>
 * ```
 */
export function Hint({
  label,
  children,
  side = "top",
  delayDuration = 200,
  className,
}: HintProps) {
  if (label === undefined || label === null || label === "") return children;
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className={className}>
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
