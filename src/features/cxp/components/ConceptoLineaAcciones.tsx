import { Copy, Percent, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  onAplicarIva: () => void;
  onDuplicar?: () => void;
  onEliminar: () => void;
}

/** Acciones del renglón; los importes y la identidad del concepto viven en el padre. */
export function ConceptoLineaAcciones({ onAplicarIva, onDuplicar, onEliminar }: Props) {
  return (
    <div className="ml-auto flex w-auto items-center justify-end gap-0.5 md:w-28">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 md:h-8 md:w-8 md:min-h-0 md:min-w-0 text-muted-foreground hover:text-primary"
            onClick={onAplicarIva}
            aria-label="Aplicar IVA 16% a esta línea"
          >
            <Percent className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-body-sm">Calcular IVA 16%</TooltipContent>
      </Tooltip>
      {onDuplicar && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 md:h-8 md:w-8 md:min-h-0 md:min-w-0 text-muted-foreground hover:text-primary"
              onClick={onDuplicar}
              aria-label="Duplicar concepto"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-body-sm">Duplicar línea</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 md:h-8 md:w-8 md:min-h-0 md:min-w-0 text-muted-foreground hover:text-destructive"
            onClick={onEliminar}
            aria-label="Eliminar concepto"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-body-sm">Eliminar línea</TooltipContent>
      </Tooltip>
    </div>
  );
}
