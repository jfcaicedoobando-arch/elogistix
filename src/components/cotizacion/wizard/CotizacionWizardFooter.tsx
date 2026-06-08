import { Button } from "@/components/ui/button";
import { Save, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";

interface Props {
  currentStep: number;
  isPending: boolean;
  saveLabel: string;
  onBack: () => void;
  onNext: () => void;
  onSave: () => void;
  /** Si true, deshabilita ambos botones (validación/guardado en curso). */
  isProcessing?: boolean;
}

export function CotizacionWizardFooter({
  currentStep,
  isPending,
  saveLabel,
  onBack,
  onNext,
  onSave,
  isProcessing = false,
}: Props) {
  const busy = isPending || isProcessing;
  return (
    <div className="flex-none border-t bg-background p-4">
      <div className="max-w-4xl mx-auto flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          {currentStep === 1
            ? "Cancelar"
            : <><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</>}
        </Button>
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
