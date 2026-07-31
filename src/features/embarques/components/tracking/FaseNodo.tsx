import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EstadoFase, FaseIconoId } from "@/features/embarques/domain/embarqueFases";
import { iconoDeFase } from "./timelineIconos";

interface Props {
  iconoId: FaseIconoId;
  estado: EstadoFase;
  /** La fase actual está en riesgo (ETA vencida sin arribo). */
  enRiesgo?: boolean;
  /** Nodo pequeño para la variante compacta. */
  tamano?: "sm" | "md";
  titulo?: string;
}

function claseNodo(estado: EstadoFase, enRiesgo: boolean): string {
  if (estado === "actual") {
    return enRiesgo
      ? "bg-warning text-warning-foreground ring-4 ring-warning/25"
      : "bg-accent text-accent-foreground ring-4 ring-accent/20";
  }
  if (estado === "completada") return "bg-accent/90 text-accent-foreground";
  return "bg-background text-muted-foreground border-border";
}

/**
 * Nodo circular de una fase. Único punto donde se define el lenguaje visual de
 * los tres estados (completada / actual / pendiente), compartido por la
 * variante compacta y la completa del stepper.
 */
export function FaseNodo({ iconoId, estado, enRiesgo = false, tamano = "md", titulo }: Props) {
  const Icono = estado === "completada" ? Check : iconoDeFase(iconoId);
  const esSm = tamano === "sm";
  return (
    <div
      title={titulo}
      aria-current={estado === "actual" ? "step" : undefined}
      className={cn(
        "flex items-center justify-center rounded-full border-2 shrink-0 transition-colors",
        estado === "pendiente" ? "border-border border-dashed" : "border-background",
        esSm ? "h-6 w-6" : "h-9 w-9",
        claseNodo(estado, enRiesgo),
      )}
    >
      <Icono className={esSm ? "h-3 w-3" : "h-4 w-4"} aria-hidden="true" />
    </div>
  );
}
