/**
 * Layout del wizard de Embarques. Delgado wrapper sobre `WizardShell`
 * (Ola 3, Lote B — v13.152.2).
 */
import { ReactNode, useCallback } from "react";
import { WizardShell } from "@/components/shared/WizardShell";

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
  const handleNext = useCallback(() => {
    if (validateStep && !validateStep(currentStep)) return;
    if (currentStep < totalSteps) setCurrentStep((p: number) => p + 1);
    else onFinish();
  }, [validateStep, currentStep, totalSteps, setCurrentStep, onFinish]);

  const handlePrev = useCallback(() => {
    if (currentStep > 1) setCurrentStep((p: number) => p - 1);
    else onBack();
  }, [currentStep, setCurrentStep, onBack]);

  return (
    <WizardShell
      title={title}
      subtitle={subtitle}
      steps={steps}
      currentStep={currentStep}
      onStepClick={(s) => setCurrentStep(s)}
      onBack={onBack}
      isBusy={isPending}
      defaultFooter={{
        onPrev: handlePrev,
        onNext: handleNext,
        onSave: onFinish,
        saveLabel,
      }}
    >
      {children}
    </WizardShell>
  );
}
