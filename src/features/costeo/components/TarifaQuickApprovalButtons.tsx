/**
 * Botones inline de Aprobar / Rechazar para tarifas en estado "borrador".
 * v13.142.4: extraídos del hover oculto que no se podía usar.
 * Dos variantes:
 *   - "grouped" → botones con texto (vista agrupada, hay espacio).
 *   - "table"   → icon-only con tooltip (vista tabla densa).
 */
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface Props {
  variant: "grouped" | "table";
  onAprobar: () => void;
  onRechazar: () => void;
  disabled?: boolean;
}

export function TarifaQuickApprovalButtons({ variant, onAprobar, onRechazar, disabled }: Props) {
  if (variant === "grouped") {
    return (
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 border-success/40 text-success hover:bg-success/10 hover:text-success"
          onClick={(e) => { e.stopPropagation(); onAprobar(); }}
          disabled={disabled}
          title="Aprobar tarifa"
        >
          <Check className="size-3.5 mr-1" />Aprobar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onRechazar(); }}
          disabled={disabled}
          title="Rechazar tarifa"
        >
          <X className="size-3.5 mr-1" />Rechazar
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7 text-success hover:bg-success/10 hover:text-success"
        onClick={(e) => { e.stopPropagation(); onAprobar(); }}
        disabled={disabled}
        title="Aprobar tarifa"
        aria-label="Aprobar tarifa"
      >
        <Check className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={(e) => { e.stopPropagation(); onRechazar(); }}
        disabled={disabled}
        title="Rechazar tarifa"
        aria-label="Rechazar tarifa"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
