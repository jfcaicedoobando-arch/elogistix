import { Button } from "@/components/ui/button";
import { Save, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";

interface Props {
  currentStep: number;
  isPending: boolean;
  saveLabel: string;
  onBack: () => void;
  onNext: () => void;
  onSave: () => void;
}

export function CotizacionWizardFooter({
  currentStep,
  isPending,
  saveLabel,
  onBack,
  onNext,
  onSave,
}: Props) {
  return (
    <div className="flex-none border-t bg-background p-4">
      <div className="max-w-4xl mx-auto flex justify-between">
        <Button variant="outline" onClick={onBack}>
          {currentStep === 1
            ? "Cancelar"
            : <><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</>}
        </Button>
        <Button
          disabled={isPending}
          onClick={() => { if (currentStep < 4) onNext(); else onSave(); }}
        >
          {isPending
            ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Guardando...</>
            : currentStep === 4
              ? <><Save className="h-4 w-4 mr-1" /> {saveLabel}</>
              : <>Siguiente <ChevronRight className="h-4 w-4 ml-1" /></>}
        </Button>
      </div>
    </div>
  );
}
