import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Package, StickyNote, Check } from "lucide-react";
import { WizardSection } from "@/components/shared/WizardSection";
import SeccionDestinatario from "@/features/cotizacion/components/SeccionDestinatario";
import SeccionDatosGeneralesCotizacion from "@/features/cotizacion/components/SeccionDatosGeneralesCotizacion";
import SeccionRutaCotizacion from "@/features/cotizacion/components/SeccionRutaCotizacion";
import SeccionMercanciaMaritimaFCL from "@/features/cotizacion/components/SeccionMercanciaMaritimaFCL";
import SeccionMercanciaMaritimaLCL from "@/features/cotizacion/components/SeccionMercanciaMaritimaLCL";
import SeccionMercanciaGeneral from "@/features/cotizacion/components/SeccionMercanciaGeneral";
import SeccionMercanciaAerea from "@/features/cotizacion/components/SeccionMercanciaAerea";
import TarifaVinculadaPanel from "@/features/cotizacion/components/TarifaVinculadaPanel";
import { usePaso1SectionStatus } from "@/features/cotizacion/hooks/usePaso1SectionStatus";

import type { useCotizacionWizardForm } from "@/features/cotizacion/hooks";

interface Props {
  w: ReturnType<typeof useCotizacionWizardForm>;
  clientes: { id: string; nombre: string }[];
}

/**
 * Paso 1 del wizard de cotización. Orden conversacional v13.28.0:
 *   1. Cliente → 2. Operación → 3. Ruta → 4. Mercancía → 5. Tarifa → 6. Cierre.
 * v13.29.0: cada sección muestra un check verde cuando sus campos requeridos
 * están completos (`usePaso1SectionStatus`).
 */
export default function PasoDatosGenerales({ w, clientes }: Props) {
  const { form } = w;
  const tipoEmbarque = form.watch("tipoEmbarque");
  const status = usePaso1SectionStatus();

  return (
    <>
      {/* 1. Cliente */}
      <div id="seccion-cliente" className="scroll-mt-4">
        <SeccionDestinatario clientes={clientes} complete={status.cliente} />
      </div>

      {/* 2. Operación */}
      <div id="seccion-operacion" className="scroll-mt-4">
        <SeccionDatosGeneralesCotizacion complete={status.operacion} />
      </div>

      {/* 3. Ruta */}
      <div id="seccion-ruta" className="scroll-mt-4">
        <SeccionRutaCotizacion complete={status.ruta} />
      </div>

      {/* 4. Mercancía */}
      <div id="seccion-mercancia" className="scroll-mt-4">
        <WizardSection title="Mercancía" complete={status.mercancia}>
          {w.esMaritimo ? (
            <div className="space-y-4">
              <RadioGroup
                value={tipoEmbarque}
                onValueChange={(v) => w.handleCambiarTipoEmbarque(v as "FCL" | "LCL")}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="FCL" id="tipo-fcl" />
                  <Label htmlFor="tipo-fcl" className="cursor-pointer text-sm font-medium">
                    FCL (Contenedor completo)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="LCL" id="tipo-lcl" />
                  <Label htmlFor="tipo-lcl" className="cursor-pointer text-sm font-medium">
                    LCL (Carga consolidada)
                  </Label>
                </div>
              </RadioGroup>
              {tipoEmbarque === "FCL" ? (
                <SeccionMercanciaMaritimaFCL msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
              ) : (
                <SeccionMercanciaMaritimaLCL msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
              )}
            </div>
          ) : w.esAereo ? (
            <SeccionMercanciaAerea msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
          ) : (
            <SeccionMercanciaGeneral msdsFile={w.msdsFile} setMsdsFile={w.setMsdsFile} />
          )}
        </WizardSection>
      </div>

      {/* 5. Tarifa vinculada (sólo marítimo) */}
      <div id="seccion-tarifa" className="scroll-mt-4">
        <TarifaVinculadaPanel complete={status.tarifa} />
      </div>

      {/* 6. Cierre */}
      <div id="seccion-cierre" className="scroll-mt-4">
        <Accordion type="multiple" defaultValue={["num-embarques", "notas"]} className="w-full">
          <AccordionItem value="num-embarques">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Número de Embarques
                {status.cierre && (
                  <span
                    className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-success/15 text-success"
                    aria-label="Sección completa"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-2">
              <Label htmlFor="cot-num-contenedores">Número de contenedores</Label>
              <Input
                id="cot-num-contenedores"
                type="number" min={1}
                value={form.watch("numContenedores")}
                onChange={(e) => form.setValue("numContenedores", Math.max(1, parseInt(e.target.value) || 1))}
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
              <Label htmlFor="cot-notas">Notas</Label>
              <Textarea
                id="cot-notas"
                value={form.watch("notas")}
                onChange={(e) => form.setValue("notas", e.target.value)}
                placeholder="Observaciones o condiciones..."
                rows={3}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
}
