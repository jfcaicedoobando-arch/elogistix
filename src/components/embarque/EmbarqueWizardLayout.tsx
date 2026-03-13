import { ReactNode } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/embarque/StepIndicator";

interface Step {
  title: string;
  num: number;
}

interface EmbarqueWizardLayoutProps {
  title: string;
  subtitle: string;
  steps: Step[];
  currentStep: number;
  setCurrentStep: (step: number | ((prev: number) => number)) => void;
  totalSteps: number;
  isPending: boolean;
  saveLabel: string;
  onBack: () => void;
  onFinish: () => void;
  /** Optional validation before advancing from a specific step. Return false to block. */
  validateStep?: (step: number) => boolean;
  children: ReactNode;
}

export function EmbarqueWizardLayout({
  title,
  subtitle,
  steps,
  currentStep,
  setCurrentStep,
  totalSteps,
  isPending,
  saveLabel,
  onBack,
  onFinish,
  validateStep,
  children,
}: EmbarqueWizardLayoutProps) {
  const handleNext = () => {
    if (validateStep && !validateStep(currentStep)) return;
    if (currentStep < totalSteps) setCurrentStep((p: number) => p + 1);
    else onFinish();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
      {/* Header fijo */}
      <div className="flex-none border-b bg-background p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <StepIndicator steps={steps} currentStep={currentStep} />
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {children}
        </div>
      </div>

      {/* Footer fijo */}
      <div className="flex-none border-t bg-background p-4">
        <div className="max-w-4xl mx-auto flex justify-between">
          <Button variant="outline" onClick={() => currentStep > 1 ? setCurrentStep((p: number) => p - 1) : onBack()}>
            {currentStep === 1 ? 'Cancelar' : <><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</>}
          </Button>
          <Button disabled={isPending} onClick={handleNext}>
            {isPending ? 'Guardando...' : currentStep === totalSteps ? <><Save className="h-4 w-4 mr-1" /> {saveLabel}</> : <>Siguiente <ChevronRight className="h-4 w-4 ml-1" /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}
