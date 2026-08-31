import { useCallback, useState } from "react";
import { FormProvider } from "react-hook-form";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { WizardShell } from "@/components/shared/WizardShell";
import { CotizacionWizardFooter } from "@/features/cotizacion/components/wizard/CotizacionWizardFooter";
import { CotizacionWizardSteps } from "@/features/cotizacion/components/wizard/CotizacionWizardSteps";
import { ConfirmSinDesgloseDialog } from "@/features/cotizacion/components/ConfirmSinDesgloseDialog";
import { WizardTotalsBar } from "@/features/cotizacion/components/wizard/WizardTotalsBar";
import { useCotizacionKeyboardShortcuts } from "@/features/cotizacion/hooks/wizard/useCotizacionKeyboardShortcuts";
import { usePermissions } from "@/hooks/shared";
import { useDirtyGuard } from "@/hooks/shared/useDirtyGuard";

import { notifyError } from "@/lib/ui/appFeedback";
const WIZARD_STEPS = [
  { num: 1, title: "Datos Generales" },
  { num: 2, title: "Costos y utilidad" },
  { num: 3, title: "Cotización del cliente" },
  { num: 4, title: "Resumen" },
];

type WizardForm = ReturnType<typeof import("@/features/cotizacion/hooks").useCotizacionWizardForm>;

interface CotizacionWizardLayoutProps {
  w: WizardForm;
  clientes: { id: string; nombre: string }[];
  title: string;
  subtitle?: string;
  onBack: () => void;
  saveLabel: string;
  /** P1 (v13.294.1): flush del autosave para atajo Ctrl/Cmd+S. */
  onFlushDraft?: () => void;
}

export default function CotizacionWizardLayout({
  w,
  clientes,
  title,
  subtitle,
  onBack,
  saveLabel,
  onFlushDraft,
}: CotizacionWizardLayoutProps) {
  const { form, handleSiguiente, handleGuardar, handleBack: wHandleBack, handleCotizarSinDesglose, isPending } = w;
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSinDesglose, setShowSinDesglose] = useState(false);
  const isBusy = isProcessing || isPending;
  const sinDesgloseFlag = !!form.watch("sinDesgloseCostos");
  const modoActual = (form.watch("modo") || "").toString().toLowerCase();
  const esMaritimo = modoActual.startsWith("mar");
  const { canCotizarSinDesglose } = usePermissions();

  const runProcessing = useCallback(async (fn: () => unknown | Promise<unknown>) => {
    if (isBusy) return;
    setIsProcessing(true);
    try { await fn(); } finally { setIsProcessing(false); }
  }, [isBusy]);

  const handleNext = useCallback(() => { void runProcessing(handleSiguiente); }, [runProcessing, handleSiguiente]);
  const handleSave = useCallback(() => { void runProcessing(handleGuardar); }, [runProcessing, handleGuardar]);
  // Ola C · #13: guarda de salida. Antes se podía navegar (sidebar, migas) con
  // el wizard a medio capturar y se perdía todo sin aviso.
  // RN-EC-5: el "Volver" del header era navegación programática y saltaba la
  // guarda; ahora también pasa por confirmarSalida.
  // v13.819.1: el botón "Cancelar" del paso 1 también navegaba directo al
  // listado sin advertir de la captura pendiente.
  const { guardDialog, confirmarSalida } = useDirtyGuard(form.formState.isDirty && !isBusy);
  const handleBack = useCallback(
    () => ejecutarSalidaWizard({
      currentStep: w.currentStep,
      isBusy,
      retroceder: wHandleBack,
      confirmarSalida,
    }),
    [w.currentStep, isBusy, wHandleBack, confirmarSalida],
  );

  const handleConfirmSinDesglose = useCallback(() => {
    if (!canCotizarSinDesglose) {
      notifyError(undefined, { title: "Tu rol no autoriza cotizar sin desglose. Pide a un gerente o admin.", method: "FEATURES_COTIZACION_COMPONENTS_COTIZACIONWIZARDLAYOUT_1" });
      setShowSinDesglose(false);
      return;
    }
    setShowSinDesglose(false);
    void runProcessing(handleCotizarSinDesglose);
  }, [runProcessing, handleCotizarSinDesglose, canCotizarSinDesglose]);

  const handleOpenSinDesglose = useCallback(() => {
    if (!canCotizarSinDesglose) {
      notifyError(undefined, { title: "Tu rol no autoriza cotizar sin desglose. Pide a un gerente o admin.", method: "FEATURES_COTIZACION_COMPONENTS_COTIZACIONWIZARDLAYOUT_2" });
      return;
    }
    setShowSinDesglose(true);
  }, [canCotizarSinDesglose]);

  const irACargarCostos = useCallback(() => {
    if (!isBusy) wHandleBack();
  }, [isBusy, wHandleBack]);

  const mostrarTotales = w.currentStep === 2 || w.currentStep === 3;

  // Ola C · #13: guarda de salida. Antes se podía navegar (sidebar, migas) con
  // el wizard a medio capturar y se perdía todo sin aviso.
  // RN-EC-5: el "Volver" del header era navegación programática y saltaba la
  // guarda; ahora también pasa por confirmarSalida.
  const { guardDialog, confirmarSalida } = useDirtyGuard(form.formState.isDirty && !isBusy);
  const handleBackHeader = useCallback(() => { confirmarSalida(onBack); }, [confirmarSalida, onBack]);

  // P1 (v13.294.0) — atajos de teclado del wizard.
  const handleFlushDraft = useCallback(() => {
    if (!onFlushDraft) return;
    onFlushDraft();
    notifySuccess(undefined, { title: "Borrador guardado" });
  }, [onFlushDraft]);
  useCotizacionKeyboardShortcuts({
    currentStep: w.currentStep,
    onNext: handleNext,
    onSave: handleSave,
    onBack: handleBack,
    onFlushDraft: onFlushDraft ? handleFlushDraft : undefined,
  });

  return (
    <FormProvider {...form}>
      <WizardShell
        title={title}
        subtitle={subtitle}
        steps={WIZARD_STEPS}
        currentStep={w.currentStep}
        onStepClick={(s) => w.setCurrentStep(s)}
        onBack={handleBackHeader}
        isBusy={isBusy}
        contentMaxWidth="6xl"
        footer={
          <CotizacionWizardFooter
            currentStep={w.currentStep}
            isPending={w.isPending}
            isProcessing={isProcessing}
            saveLabel={saveLabel}
            onBack={handleBack}
            onNext={handleNext}
            onSave={handleSave}
            onCotizarSinDesglose={handleOpenSinDesglose}
            canSkipCostos={canCotizarSinDesglose}
          />
        }
      >
        <CotizacionWizardSteps
          w={w}
          clientes={clientes}
          esMaritimo={esMaritimo}
          sinDesgloseFlag={sinDesgloseFlag}
          irACargarCostos={irACargarCostos}
        />
        {mostrarTotales && (
          <WizardTotalsBar
            plUSD={w.plUSD}
            plMXN={w.plMXN}
            totalVentaMXN={w.totalMXN}
          />
        )}
      </WizardShell>

      <ConfirmSinDesgloseDialog
        open={showSinDesglose}
        onOpenChange={setShowSinDesglose}
        onConfirm={handleConfirmSinDesglose}
        isPending={isBusy}
      />
      {guardDialog}
    </FormProvider>
  );
}

