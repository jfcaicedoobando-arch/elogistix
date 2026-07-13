import { Button } from "@/components/ui/button";
import { Save, ChevronRight, ChevronLeft, Loader2, AlertTriangle, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  currentStep: number;
  isPending: boolean;
  saveLabel: string;
  onBack: () => void;
  onNext: () => void;
  onSave: () => void;
  /** Atajo Paso 1: cotizar sin desglose de costos (salta al Paso 3). */
  onCotizarSinDesglose?: () => void;
  /** Si true, deshabilita ambos botones (validación/guardado en curso). */
  isProcessing?: boolean;
  /** Role gate (Pack D): sólo gerencia/admin puede ver el atajo destructivo. */
  canSkipCostos?: boolean;
}

export function CotizacionWizardFooter({
  currentStep,
  isPending,
  saveLabel,
  onBack,
  onNext,
  onSave,
  onCotizarSinDesglose,
  isProcessing = false,
  canSkipCostos = false,
}: Props) {
  const busy = isPending || isProcessing;
  // v13.293.0 (P0): "Cotizar sin desglose" ya no compite con "Siguiente".
  // Se relega a un menú "Más acciones" para bajar riesgo de click accidental.
  const mostrarMenuMas = currentStep === 1 && !!onCotizarSinDesglose && canSkipCostos;
  return (
    <div className="flex flex-wrap gap-2 justify-between items-center">
      <Button variant="outline" onClick={onBack} disabled={busy}>
        {currentStep === 1
          ? "Cancelar"
          : <><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</>}
      </Button>
      <div className="flex flex-wrap gap-2 items-center">
        {mostrarMenuMas && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={busy} aria-label="Más acciones">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem
                onClick={onCotizarSinDesglose}
                disabled={busy}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">Cotizar sin desglose</span>
                  <span className="text-xs text-muted-foreground">
                    Salta al paso 3. El embarque quedará bloqueado hasta cargar costos.
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          disabled={busy}
          onClick={() => { if (currentStep < 4) onNext(); else onSave(); }}
        >
          {busy
            ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {currentStep === 4 ? "Guardando..." : "Procesando..."}</>
            : currentStep === 4
              ? <><Save className="h-4 w-4 mr-1" /> {saveLabel}</>
              : <>Siguiente <ChevronRight className="h-4 w-4 ml-1" /></>}
        </Button>
      </div>
    </div>
  );
}
