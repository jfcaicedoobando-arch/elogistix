import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Info } from "lucide-react";
import { StepIndicator } from "@/features/embarques/components/StepIndicator";
import SeccionConceptosVentaCotizacion from "@/components/cotizacion/SeccionConceptosVentaCotizacion";
import SeccionCostosInternosPLUnificado from "@/components/cotizacion/SeccionCostosInternosPLUnificado";
import PasoResumenCotizacion from "@/components/cotizacion/PasoResumenCotizacion";
import PasoDatosGenerales from "@/components/cotizacion/wizard/PasoDatosGenerales";
import { CotizacionWizardFooter } from "@/components/cotizacion/wizard/CotizacionWizardFooter";

const WIZARD_STEPS = [
  { num: 1, title: "Datos Generales" },
  { num: 2, title: "Costos & P&L" },
  { num: 3, title: "Cotización Cliente" },
  { num: 4, title: "Resumen" },
];

type WizardForm = ReturnType<typeof import("@/hooks/cotizacion").useCotizacionWizardForm>;

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
  const { form, handleSiguiente, handleGuardar, handleBack: wHandleBack, currentStep, isPending } = w;
  const contentRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isBusy = isProcessing || isPending;

  const runProcessing = useCallback(async (fn: () => unknown | Promise<unknown>) => {
    if (isBusy) return;
    setIsProcessing(true);
    try { await fn(); } finally { setIsProcessing(false); }
  }, [isBusy]);

  const handleNext = useCallback(() => { void runProcessing(handleSiguiente); }, [runProcessing, handleSiguiente]);
  const handleSave = useCallback(() => { void runProcessing(handleGuardar); }, [runProcessing, handleGuardar]);
  const handleBack = useCallback(() => { if (!isBusy) wHandleBack(); }, [isBusy, wHandleBack]);
  const handleTopBack = useCallback(() => { if (!isBusy) onBack(); }, [isBusy, onBack]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const el = contentRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([readonly]), select, textarea, [role="combobox"]',
      );
      el?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [currentStep]);

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
          <StepIndicator steps={WIZARD_STEPS} currentStep={w.currentStep} />
        </div>

        <div className="flex-1 overflow-y-auto p-4" ref={contentRef}>
          <div className="max-w-4xl mx-auto space-y-6">
            {w.currentStep === 1 && <PasoDatosGenerales w={w} clientes={clientes} />}

            {w.currentStep === 2 && (
              <SeccionCostosInternosPLUnificado
                tipo="local"
                filas={w.costosInternos}
                setFilas={w.setCostosInternos}
              />
            )}

            {w.currentStep === 3 && (
              <>
                {w.costosPreLlenados && (
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
            )}
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
        />
      </div>
    </FormProvider>
  );
}
