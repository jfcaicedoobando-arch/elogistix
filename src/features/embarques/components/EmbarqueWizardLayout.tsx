import { ReactNode, useRef, useCallback, KeyboardEvent } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/features/embarques/components/StepIndicator";

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
  const contentRef = useRef<HTMLDivElement>(null);

  const handleNext = useCallback(() => {
    if (validateStep && !validateStep(currentStep)) return;
    if (currentStep < totalSteps) setCurrentStep((p: number) => p + 1);
    else onFinish();
  }, [validateStep, currentStep, totalSteps, setCurrentStep, onFinish]);

  // IMPORTANTE: NO envolver el contenido en <form>. Radix Select detecta el
  // form ancestro y monta `SelectBubbleInput`, que entra en conflicto con la
  // fase de mutación de React Hook Form (Controller) y produce `removeChild`
  // en el primer mount. Manejamos Enter manualmente a nivel de keydown.
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;
    if (target.tagName === 'BUTTON') return;
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'button') return;
    if (target.getAttribute('aria-expanded') === 'true') return;
    if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;
    e.preventDefault();
    if (!isPending) handleNext();
  }, [handleNext, isPending]);

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] -m-6">
      <div className="flex-none border-b bg-background p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Volver">
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          onStepClick={(s) => { if (!isPending) setCurrentStep(s); }}
        />
      </div>

      <div onKeyDown={handleKeyDown} className="flex-1 overflow-y-auto p-4" ref={contentRef}>
        <div className="max-w-4xl mx-auto space-y-6">
          {children}
        </div>
      </div>

      <div className="flex-none border-t bg-background p-4">
        <div className="max-w-4xl mx-auto flex justify-between">
          <Button variant="outline" onClick={() => currentStep > 1 ? setCurrentStep((p: number) => p - 1) : onBack()}>
            {currentStep === 1 ? 'Cancelar' : <><ChevronLeft className="h-4 w-4 mr-1" aria-hidden /> Anterior</>}
          </Button>
          <Button disabled={isPending} onClick={handleNext}>
            {isPending
              ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden /> Guardando...</>
              : currentStep === totalSteps
                ? <><Save className="h-4 w-4 mr-1" aria-hidden /> {saveLabel}</>
                : <>Siguiente <ChevronRight className="h-4 w-4 ml-1" aria-hidden /></>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
