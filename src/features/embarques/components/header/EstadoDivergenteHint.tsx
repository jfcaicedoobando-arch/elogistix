/**
 * P2-6.5 — Aviso cuando el estado calculado por fechas (ETD/ETA/llegada real)
 * difiere del estado operativo guardado en el embarque.
 *
 * El header muestra el estado calculado, así que el usuario veía "En Tránsito"
 * mientras la base seguía en "Confirmado" sin ninguna explicación. Este chip
 * hace visible la diferencia y de dónde viene.
 */
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  /** Estado calculado a partir de las fechas (el que se muestra). */
  estadoVisual: string;
  /** Estado operativo guardado en el embarque. */
  estadoGuardado: string;
}

/** ¿Hay divergencia que valga la pena avisar? */
export function hayDivergenciaEstado(estadoVisual: string, estadoGuardado: string): boolean {
  return Boolean(estadoVisual) && Boolean(estadoGuardado) && estadoVisual !== estadoGuardado;
}

export function EstadoDivergenteHint({ estadoVisual, estadoGuardado }: Props) {
  if (!hayDivergenciaEstado(estadoVisual, estadoGuardado)) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
          aria-label="El estado mostrado se calculó con las fechas del embarque"
        >
          <Info className="h-3 w-3" aria-hidden />
          Calculado por fechas
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        Se muestra <strong>{estadoVisual}</strong> porque así lo indican las fechas (ETD / ETA /
        llegada real). El estado operativo registrado es <strong>{estadoGuardado}</strong> y se
        sincroniza al avanzar el embarque.
      </TooltipContent>
    </Tooltip>
  );
}
