import { ReactNode, useEffect, useRef, useCallback, KeyboardEvent } from "react";
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
  const contentRef = useRef<HTMLFormElement>(null);

  const handleNext = useCallback(() => {
    if (validateStep && !validateStep(currentStep)) return;
    if (currentStep < totalSteps) setCurrentStep((p: number) => p + 1);
    else onFinish();
  }, [validateStep, currentStep, totalSteps, setCurrentStep, onFinish]);

  // #3 — Auto-foco al primer control al cambiar de paso (paridad con CotizacionWizardLayout).
  useEffect(() => {
    const timer = setTimeout(() => {
      const root = contentRef.current;
      if (!root || !root.isConnected) return;
      const el = root.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="combobox"]:not([disabled])',
      );
      if (el && el.isConnected) {
        try { el.focus({ preventScroll: true }); } catch { /* noop */ }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [currentStep]);

  // #4 — Enter avanza al siguiente paso desde cualquier input (excepto textarea / combobox abierto).
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!isPending) handleNext();
  }, [handleNext, isPending]);

  const handleFormKeyDown = useCallback((e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    // Permitir Enter natural en textarea y en buttons (que ya lo manejan).
    if (target.tagName === 'TEXTAREA') return;
    if (target.tagName === 'BUTTON') return;
    // Si un Radix combobox/listbox está abierto, no interceptamos.
    if (target.getAttribute('aria-expanded') === 'true') return;
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
      {/* Header fijo */}
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

      {/* Contenido scrolleable. <form> habilita Enter→Siguiente. */}
      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex-1 overflow-y-auto p-4" ref={contentRef}>
        <div className="max-w-4xl mx-auto space-y-6">
          {children}
        </div>
        {/* Submit oculto para que el form responda a Enter sin un botón visible adicional. */}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>Siguiente</button>
      </form>

      {/* Footer fijo */}
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
