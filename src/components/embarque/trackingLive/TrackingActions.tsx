import { Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { useTrackingLiveCard } from "@/hooks/embarque";

interface Props {
  ctrl: ReturnType<typeof useTrackingLiveCard>;
  blMaster: string | null | undefined;
  readOnly?: boolean;
}

export function TrackingActions({ ctrl, blMaster, readOnly }: Props) {
  if (readOnly) return null;
  const { tracking, sync, noSoportada, sinContenedor, prefixMismatch, setBolDialogOpen, onSync } = ctrl;
  return (
    <div className="flex items-center gap-2">
      {!noSoportada && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBolDialogOpen(true)}
                  disabled={!blMaster}
                >
                  <Search className="h-3.5 w-3.5 mr-1" />
                  Buscar por BL Master
                </Button>
              </span>
            </TooltipTrigger>
            {!blMaster && (
              <TooltipContent>
                Captura el BL Master en Datos / Ruta para usar esta búsqueda.
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )}
      {!noSoportada && !sinContenedor && !prefixMismatch && (
        <Button size="sm" variant="outline" onClick={onSync} disabled={sync.isPending}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${sync.isPending ? "animate-spin" : ""}`} />
          {tracking ? "Actualizar" : "Sincronizar"}
        </Button>
      )}
    </div>
  );
}
