import { useCallback, useEffect, useRef, useState, KeyboardEvent } from "react";
import { FormProvider } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Info } from "lucide-react";
import { StepIndicator } from "@/features/embarques/components/StepIndicator";
import SeccionConceptosVentaCotizacion from "@/features/cotizacion/components/SeccionConceptosVentaCotizacion";
import SeccionCostosInternosPLUnificado from "@/features/cotizacion/components/SeccionCostosInternosPLUnificado";
import PasoResumenCotizacion from "@/features/cotizacion/components/PasoResumenCotizacion";
import PasoDatosGenerales from "@/features/cotizacion/components/wizard/PasoDatosGenerales";
import Paso1ProgressSidebar from "@/features/cotizacion/components/wizard/Paso1ProgressSidebar";
import { CotizacionWizardFooter } from "@/features/cotizacion/components/wizard/CotizacionWizardFooter";
import { ConfirmSinDesgloseDialog } from "@/features/cotizacion/components/ConfirmSinDesgloseDialog";
import { SinDesgloseBanner } from "@/features/cotizacion/components/SinDesgloseBanner";
import { usePermissions } from "@/hooks/shared";

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
  const { form, handleSiguiente, handleGuardar, handleBack: wHandleBack, handleCotizarSinDesglose, currentStep, isPending } = w;
  const contentRef = useRef<HTMLFormElement>(null);
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
      toast.error("Tu rol no autoriza cotizar sin desglose. Pide a un gerente o admin.");
      setShowSinDesglose(false);
      return;
    }
    setShowSinDesglose(false);
    void runProcessing(handleCotizarSinDesglose);
  }, [runProcessing, handleCotizarSinDesglose, canCotizarSinDesglose]);

  const handleOpenSinDesglose = useCallback(() => {
    if (!canCotizarSinDesglose) {
      toast.error("Tu rol no autoriza cotizar sin desglose. Pide a un gerente o admin.");
      return;
    }
    setShowSinDesglose(true);
  }, [canCotizarSinDesglose]);

  // Auto-focus removido (v13.33.8): el setTimeout chocaba con la fase de
  // mutación de React (Strict Mode + datos resolviendo en paralelo) y producía
  // `removeChild` en el primer mount del wizard.

  const irACargarCostos = useCallback(() => {
    if (!isBusy) wHandleBack();
  }, [isBusy, wHandleBack]);

  // Enter avanza paso (paridad con EmbarqueWizardLayout).
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!isBusy) handleNext();
  }, [handleNext, isBusy]);

  const handleFormKeyDown = useCallback((e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;
    if (target.tagName === 'BUTTON') return;
    if (target.getAttribute('aria-expanded') === 'true') return;
  }, []);

  return (
    <FormProvider {...form}>
      <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
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

        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex-1 overflow-y-auto p-4" ref={contentRef}>
          <div className="max-w-6xl mx-auto">
            {w.currentStep === 1 ? (
              <div className="grid grid-cols-1 lg:grid-cols-[14rem_1fr] gap-6">
                <Paso1ProgressSidebar esMaritimo={esMaritimo} />
                <div className="space-y-6 min-w-0">
                  <PasoDatosGenerales w={w} clientes={clientes} />
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-6">
                {w.currentStep === 2 && (
                  <SeccionCostosInternosPLUnificado
                    tipo="local"
                    filas={w.costosInternos}
                    setFilas={w.setCostosInternos}
                  />
                )}

                {w.currentStep === 3 && (
                  <>
                    {sinDesgloseFlag && (
                      <SinDesgloseBanner onCargarCostos={irACargarCostos} />
                    )}
                    {w.costosPreLlenados && !sinDesgloseFlag && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-info/10 border border-info/30 [color:hsl(var(--info))] text-sm">
                        <Info className="h-4 w-4 flex-shrink-0" />
                        Pre-llenado desde Costos & P&L. Puedes ajustar si es necesario.
                      </div>
                    )}
                    <SeccionConceptosVentaCotizacion
                      conceptosUSD={w.conceptosUSD}
                      conceptosMXN={w.conceptosMXN}
                      actualizarConceptoUSD={(i, c, v) => w.actualizarConcepto("USD", i, c, v)}
                      actualizarConceptoMXN={(i, c, v) => w.actualizarConcepto("MXN", i, c, v)}
                      agregarConceptoUSD={() => w.agregarConcepto("USD")}
                      agregarConceptoMXN={() => w.agregarConcepto("MXN")}
                      eliminarConceptoUSD={(i) => w.eliminarConcepto("USD", i)}
                      eliminarConceptoMXN={(i) => w.eliminarConcepto("MXN", i)}
                      totalUSD={w.totalUSD}
                      subtotalMXN={w.subtotalMXN}
                      ivaMXN={w.ivaMXN}
                      totalMXN={w.totalMXN}
                    />
                  </>
                )}

                {w.currentStep === 4 && (
                  <>
                    {sinDesgloseFlag && (
                      <SinDesgloseBanner onCargarCostos={irACargarCostos} />
                    )}
                    <PasoResumenCotizacion
                      plUSD={w.plUSD}
                      plMXN={w.plMXN}
                      tieneCostosUSD={w.costosUSD.length > 0}
                      tieneCostosMXN={w.costosMXN.length > 0}
                      nombreCliente={form.watch("esProspecto") ? form.watch("prospectoEmpresa") : (w.clienteSeleccionado?.nombre || "—")}
                      origen={form.watch("origen")}
                      destino={form.watch("destino")}
                      numContenedores={form.watch("numContenedores")}
                      modo={form.watch("modo")}
                      incoterm={form.watch("incoterm")}
                      tipo={form.watch("tipo")}
                      totalUSD={w.totalUSD}
                      totalMXN={w.totalMXN}
                    />
                  </>
                )}
              </div>
            )}
          </div>
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>Siguiente</button>
        </form>

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
