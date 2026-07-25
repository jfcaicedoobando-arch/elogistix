/**
 * Botón individual de exportación de Estado de Cuenta.
 * Extraído para mantener baja la complejidad de ExportActions.
 */
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  icon: LucideIcon;
  tooltip: string;
  busy: boolean;
  onClick: () => void;
  disabled: boolean;
}

export function ExportFileButton({ label, icon: Icon, tooltip, busy, onClick, disabled }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Button
            variant="outline"
            size="sm"
            onClick={onClick}
            disabled={disabled}
          >
            {busy
              ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              : <Icon className="h-4 w-4 mr-1.5" />}
            {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
