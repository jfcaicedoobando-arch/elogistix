import { Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeredadoBadgeProps {
  /** Folio o etiqueta del origen (ej. "COT-2026-001"). */
  origen: string;
  /** Tipo de origen visible en el tooltip. Default: "cotización". */
  tipoOrigen?: string;
  className?: string;
}

/**
 * Pequeño badge "Heredado" que se muestra junto a campos pre-llenados
 * automáticamente desde otra entidad (cotización, tarifa, plantilla, etc.).
 * Reutilizable en wizards de cotización y embarques (v13.28.0).
 */
export function HeredadoBadge({
  origen,
  tipoOrigen = "cotización",
  className,
}: HeredadoBadgeProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={`gap-1 text-2xs font-medium uppercase tracking-wide ${className ?? ""}`}
          >
            <Link2 className="h-3 w-3" />
            Heredado
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          Pre-llenado desde {tipoOrigen} <strong>{origen}</strong>. Puedes editarlo.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

