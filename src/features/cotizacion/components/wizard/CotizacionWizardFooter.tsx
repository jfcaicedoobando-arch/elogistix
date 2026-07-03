import { Button } from "@/components/ui/button";
import { Save, ChevronRight, ChevronLeft, Loader2, AlertTriangle } from "lucide-react";

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
  const showSinDesglose = currentStep === 1 && !!onCotizarSinDesglose && canSkipCostos;
  return (
    <div className="flex flex-wrap gap-2 justify-between items-center">
      <Button variant="outline" onClick={onBack} disabled={busy}>
        {currentStep === 1
          ? "Cancelar"
          : <><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</>}
      </Button>
      <div className="flex flex-wrap gap-2">
        {showSinDesglose && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={onCotizarSinDesglose}
            className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            title="No recomendado. El embarque quedará bloqueado hasta cargar costos."
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            Cotizar sin desglose
          </Button>
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

