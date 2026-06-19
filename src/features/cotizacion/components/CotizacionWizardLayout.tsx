import { useCallback, useRef, useState, KeyboardEvent } from "react";
import { FormProvider } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { StepIndicator } from "@/features/embarques/components/StepIndicator";
import { CotizacionWizardFooter } from "@/features/cotizacion/components/wizard/CotizacionWizardFooter";
import { CotizacionWizardSteps } from "@/features/cotizacion/components/wizard/CotizacionWizardSteps";
import { ConfirmSinDesgloseDialog } from "@/features/cotizacion/components/ConfirmSinDesgloseDialog";
import { usePermissions } from "@/hooks/shared";

import { notifyError } from "@/components/shared/utils/appFeedback";
const WIZARD_STEPS = [
  { num: 1, title: "Datos Generales" },
  { num: 2, title: "Costos & P&L" },
  { num: 3, title: "Cotización Cliente" },
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
}

export default function CotizacionWizardLayout({
  w,
  clientes,
  title,
  subtitle,
  onBack,
  saveLabel,
}: CotizacionWizardLayoutProps) {
  const { form, handleSiguiente, handleGuardar, handleBack: wHandleBack, handleCotizarSinDesglose, isPending } = w;
  const contentRef = useRef<HTMLDivElement>(null);
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
  const handleBack = useCallback(() => { if (!isBusy) wHandleBack(); }, [isBusy, wHandleBack]);
  const handleTopBack = useCallback(() => { if (!isBusy) onBack(); }, [isBusy, onBack]);
  const handleConfirmSinDesglose = useCallback(() => {
    if (!canCotizarSinDesglose) {
      notifyError(toast, { title: "Tu rol no autoriza cotizar sin desglose. Pide a un gerente o admin.", method: "FEATURES_COTIZACION_COMPONENTS_COTIZACIONWIZARDLAYOUT_1" });
      setShowSinDesglose(false);
      return;
    }
    setShowSinDesglose(false);
    void runProcessing(handleCotizarSinDesglose);
  }, [runProcessing, handleCotizarSinDesglose, canCotizarSinDesglose]);

  const handleOpenSinDesglose = useCallback(() => {
    if (!canCotizarSinDesglose) {
      notifyError(toast, { title: "Tu rol no autoriza cotizar sin desglose. Pide a un gerente o admin.", method: "FEATURES_COTIZACION_COMPONENTS_COTIZACIONWIZARDLAYOUT_2" });
      return;
    }
    setShowSinDesglose(true);
  }, [canCotizarSinDesglose]);

  const irACargarCostos = useCallback(() => {
    if (!isBusy) wHandleBack();
  }, [isBusy, wHandleBack]);

  // IMPORTANTE: NO envolver el contenido en <form>. Radix Select detecta el
  // form ancestro y monta `SelectBubbleInput`, que entra en conflicto con
  // React Hook Form (Controller) y produce `removeChild` en el primer mount.
  // Enter→Siguiente se maneja a nivel de keydown sobre el contenedor.
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;
    if (target.tagName === 'BUTTON') return;
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'button') return;
    if (target.getAttribute('aria-expanded') === 'true') return;
    if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;
    e.preventDefault();
    if (!isBusy) handleNext();
  }, [handleNext, isBusy]);

  return (
    <FormProvider {...form}>
      <div className="flex flex-col h-[calc(100dvh-4rem)] -m-6">
        <div className="flex-none border-b bg-background p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleTopBack} aria-label="Volver" disabled={isBusy}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <StepIndicator
            steps={WIZARD_STEPS}
            currentStep={w.currentStep}
            onStepClick={(s) => { if (!isBusy) w.setCurrentStep(s); }}
          />
        </div>

        <div onKeyDown={handleKeyDown} className="flex-1 overflow-y-auto p-4" ref={contentRef}>
          <div className="max-w-6xl mx-auto">
            <CotizacionWizardSteps
              w={w}
              clientes={clientes}
              esMaritimo={esMaritimo}
              sinDesgloseFlag={sinDesgloseFlag}
              irACargarCostos={irACargarCostos}
            />
          </div>
        </div>

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
      </div>

      <ConfirmSinDesgloseDialog
        open={showSinDesglose}
        onOpenChange={setShowSinDesglose}
        onConfirm={handleConfirmSinDesglose}
        isPending={isBusy}
      />
    </FormProvider>
  );
}
