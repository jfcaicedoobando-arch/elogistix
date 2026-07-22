/**
 * Chip narrativo del ajuste cotizado→facturado para cada renglón de la tabla
 * de costos directos. Basado en `<ToneBadge>` (lenguaje visual CxP).
 */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ToneBadge } from "@/features/cxp/components/ToneBadge";
import type { AjusteDescripcion } from "./ajusteDescripcion";

interface Props {
  descripcion: AjusteDescripcion;
}

export function AjusteChip({ descripcion }: Props) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help inline-flex">
            <ToneBadge tone={descripcion.tone}>
              <span aria-hidden className="mr-1">{descripcion.icono}</span>
              {descripcion.titulo}
            </ToneBadge>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{descripcion.detalle}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
