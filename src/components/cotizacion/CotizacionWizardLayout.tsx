import { useEffect, useRef } from "react";
import { FormProvider } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, Save, ChevronRight, ChevronLeft, Info, Package, StickyNote, Loader2 } from "lucide-react";

import { StepIndicator } from "@/components/embarque/StepIndicator";
import SeccionDestinatario from "@/components/cotizacion/SeccionDestinatario";
import SeccionDatosGeneralesCotizacion from "@/components/cotizacion/SeccionDatosGeneralesCotizacion";
import SeccionRutaCotizacion from "@/components/cotizacion/SeccionRutaCotizacion";
import SeccionConceptosVentaCotizacion from "@/components/cotizacion/SeccionConceptosVentaCotizacion";
import SeccionMercanciaMaritimaFCL from "@/components/cotizacion/SeccionMercanciaMaritimaFCL";
import SeccionMercanciaMaritimeLCL from "@/components/cotizacion/SeccionMercanciaMaritimeLCL";
import SeccionMercanciaGeneral from "@/components/cotizacion/SeccionMercanciaGeneral";
import SeccionMercanciaAerea from "@/components/cotizacion/SeccionMercanciaAerea";
import SeccionCostosInternosPLUnificado from "@/components/cotizacion/SeccionCostosInternosPLUnificado";
import PasoResumenCotizacion from "@/components/cotizacion/PasoResumenCotizacion";

const WIZARD_STEPS = [
  { num: 1, title: "Datos Generales" },
  { num: 2, title: "Costos & P&L" },
  { num: 3, title: "Cotización Cliente" },
  { num: 4, title: "Resumen" },
];

interface CotizacionWizardLayoutProps {
  w: ReturnType<typeof import("@/hooks/useCotizacionWizardForm").useCotizacionWizardForm>;
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
  const { form } = w;
  const tipoEmbarque = form.watch("tipoEmbarque");
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-focus first input on step change
  useEffect(() => {
    const timer = setTimeout(() => {
      const el = contentRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([readonly]), select, textarea, [role="combobox"]'
      );
      el?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [w.currentStep]);

  return (
    <FormProvider {...form}>
      <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
        {/* Header fijo */}
        <div className="flex-none border-b bg-background p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <StepIndicator steps={WIZARD_STEPS} currentStep={w.currentStep} />
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-4" ref={contentRef}>
          <div className="max-w-4xl mx-auto space-y-6">
            {/* PASO 1 — Datos Generales */}
            {w.currentStep === 1 && (
              <>
                <SeccionDestinatario clientes={clientes} />
                <SeccionDatosGeneralesCotizacion />
                <Card>
                  <CardHeader><CardTitle className="text-lg">Mercancía</CardTitle></CardHeader>
                  <CardContent>
                    {w.esMaritimo ? (
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="tipo-embarque" checked={tipoEmbarque === "FCL"} onChange={() => w.handleCambiarTipoEmbarque("FCL")} className="accent-primary" />
                            <span className="text-sm font-medium">FCL (Contenedor completo)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="tipo-embarque" checked={tipoEmbarque === "LCL"} onChange={() => w.handleCambiarTipoEmbarque("LCL")} className="accent-primary" />
                            <span className="text-sm font-medium">LCL (Carga consolidada)</span>
                          </label>
                        </div>
                        {tipoEmbarque === "FCL" ? (
                          <SeccionMercanciaMaritimaFCL msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
                        ) : (
                          <SeccionMercanciaMaritimeLCL msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
                        )}
                      </div>
                    ) : w.esAereo ? (
                      <SeccionMercanciaAerea msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
                    ) : (
                      <SeccionMercanciaGeneral msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
                    )}
                  </CardContent>
                </Card>
                <SeccionRutaCotizacion />

                {/* Campos opcionales colapsados */}
                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="num-embarques">
                    <AccordionTrigger className="text-base font-semibold hover:no-underline">
                      <span className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Número de Embarques
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                      <Label>Número de contenedores</Label>
                      <Input
                        type="number" min={1}
                        value={form.watch("numContenedores")}
                        onChange={e => form.setValue("numContenedores", Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-32 mt-1"
                      />
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="notas">
                    <AccordionTrigger className="text-base font-semibold hover:no-underline">
                      <span className="flex items-center gap-2">
                        <StickyNote className="h-5 w-5 text-primary" />
                        Notas Adicionales
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                      <Label>Notas</Label>
                      <Textarea value={form.watch("notas")} onChange={e => form.setValue("notas", e.target.value)} placeholder="Observaciones o condiciones..." rows={3} />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            )}

            {/* PASO 2 — Costos & P&L */}
            {w.currentStep === 2 && (
              <SeccionCostosInternosPLUnificado tipo="local" filas={w.costosInternos} setFilas={w.setCostosInternos} />
            )}

            {/* PASO 3 — Cotización Cliente */}
            {w.currentStep === 3 && (
              <>
                {w.costosPreLlenados && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-sm">
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

            {/* PASO 4 — Resumen */}
            {w.currentStep === 4 && (
              <PasoResumenCotizacion
                plUSD={w.plUSD} plMXN={w.plMXN}
                tieneCostosUSD={w.costosUSD.length > 0}
                tieneCostosMXN={w.costosMXN.length > 0}
                nombreCliente={form.watch("esProspecto") ? form.watch("prospectoEmpresa") : (w.clienteSeleccionado?.nombre || "—")}
                origen={form.watch("origen")} destino={form.watch("destino")}
                numContenedores={form.watch("numContenedores")} modo={form.watch("modo")}
                incoterm={form.watch("incoterm")} tipo={form.watch("tipo")}
                totalUSD={w.totalUSD} totalMXN={w.totalMXN}
              />
            )}
          </div>
        </div>

        {/* Footer fijo */}
        <div className="flex-none border-t bg-background p-4">
          <div className="max-w-4xl mx-auto flex justify-between">
            <Button variant="outline" onClick={w.handleBack}>
              {w.currentStep === 1 ? "Cancelar" : <><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</>}
            </Button>
            <Button
              disabled={w.isPending}
              onClick={() => { if (w.currentStep < 4) w.handleSiguiente(); else w.handleGuardar(); }}
            >
              {w.isPending
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Guardando...</>
                : w.currentStep === 4
                  ? <><Save className="h-4 w-4 mr-1" /> {saveLabel}</>
                  : <>Siguiente <ChevronRight className="h-4 w-4 ml-1" /></>
              }
            </Button>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}