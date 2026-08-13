/**
 * Layout del wizard de Embarques. Delgado wrapper sobre `WizardShell`
 * (Ola 3, Lote B — v13.152.2).
 */
import { ReactNode, useCallback } from "react";
import { WizardShell } from "@/components/shared/WizardShell";
import { useDirtyGuard } from "@/hooks/shared/useDirtyGuard";

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
  /** FE-11: cuando hay captura sin guardar, avisa antes de salir del wizard. */
  isDirty?: boolean;
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
  isDirty = false,
  children,
}: EmbarqueWizardLayoutProps) {
  // FE-11: durante el guardado no se bloquea la navegación (el redirect es
  // intencional); sólo cuando hay captura pendiente.
  const { guardDialog, confirmarSalida } = useDirtyGuard(isDirty && !isPending);

  // RFE-05 (Ola 11): el "Atrás" del shell sale con navigate() directo y se
  // saltaba el aviso; se canaliza por la misma confirmación del dirty guard.
  const handleBack = useCallback(() => {
    confirmarSalida(onBack);
  }, [confirmarSalida, onBack]);

  const handleNext = useCallback(() => {
    if (validateStep && !validateStep(currentStep)) return;
    if (currentStep < totalSteps) setCurrentStep((p: number) => p + 1);
    else onFinish();
  }, [validateStep, currentStep, totalSteps, setCurrentStep, onFinish]);

  const handlePrev = useCallback(() => {
    if (currentStep > 1) setCurrentStep((p: number) => p - 1);
    else handleBack();
  }, [currentStep, setCurrentStep, handleBack]);

  return (
    <WizardShell
      title={title}
      subtitle={subtitle}
      steps={steps}
      currentStep={currentStep}
      onStepClick={(s) => setCurrentStep(s)}
      onBack={handleBack}
      isBusy={isPending}
      defaultFooter={{
        onPrev: handlePrev,
        onNext: handleNext,
        onSave: onFinish,
        saveLabel,
      }}
    >
      {guardDialog}
      {children}
    </WizardShell>
  );
}
