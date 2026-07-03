/**
 * `<LoadingState />` — placeholder de carga estándar.
 *
 * Reemplaza los `Loader2` centrados a mano que hoy viven en 15+ páginas.
 */
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  /** Texto opcional bajo el spinner. Default: "Cargando…". */
  label?: string;
  className?: string;
  /** Altura mínima del contenedor. Default: `min-h-[240px]`. */
  minHeight?: string;
}

export function LoadingState({
  label = "Cargando…",
  className,
  minHeight = "min-h-[240px]",
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        minHeight,
        className,
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );
}
