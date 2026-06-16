import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Package, StickyNote } from "lucide-react";
import { WizardSection } from "@/components/shared/WizardSection";
import SeccionDestinatario from "@/features/cotizacion/components/SeccionDestinatario";
import SeccionDatosGeneralesCotizacion from "@/features/cotizacion/components/SeccionDatosGeneralesCotizacion";
import SeccionRutaCotizacion from "@/features/cotizacion/components/SeccionRutaCotizacion";
import SeccionMercanciaMaritimaFCL from "@/features/cotizacion/components/SeccionMercanciaMaritimaFCL";
import SeccionMercanciaMaritimaLCL from "@/features/cotizacion/components/SeccionMercanciaMaritimaLCL";
import SeccionMercanciaGeneral from "@/features/cotizacion/components/SeccionMercanciaGeneral";
import SeccionMercanciaAerea from "@/features/cotizacion/components/SeccionMercanciaAerea";
import TarifaVinculadaPanel from "@/features/cotizacion/components/TarifaVinculadaPanel";

import type { useCotizacionWizardForm } from "@/features/cotizacion/hooks";

interface Props {
  w: ReturnType<typeof useCotizacionWizardForm>;
  clientes: { id: string; nombre: string }[];
}

/**
 * Paso 1 del wizard de cotización. Orden conversacional v13.28.0:
 *   1. Cliente → 2. Operación → 3. Ruta → 4. Mercancía → 5. Tarifa → 6. Cierre.
 * Sigue cómo piensa un ejecutivo: primero quién y qué tipo de servicio,
 * después por dónde, después qué se mueve, después con qué tarifa, y al final
 * los detalles administrativos (# contenedores + notas).
 */
export default function PasoDatosGenerales({ w, clientes }: Props) {
  const { form } = w;
  const tipoEmbarque = form.watch("tipoEmbarque");

  return (
    <>
      {/* 1. Cliente */}
      <SeccionDestinatario clientes={clientes} />

      {/* 2. Operación: modo / tipo / incoterm */}
      <SeccionDatosGeneralesCotizacion />

      {/* 3. Ruta */}
      <SeccionRutaCotizacion />

      {/* 4. Mercancía */}
      <WizardSection title="Mercancía">
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

      {/* 5. Tarifa vinculada (sólo marítimo) */}
      <TarifaVinculadaPanel />

      {/* 6. Cierre */}
      <Accordion type="multiple" defaultValue={["num-embarques", "notas"]} className="w-full">
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
            <Label>Notas</Label>
            <Textarea
              value={form.watch("notas")}
              onChange={(e) => form.setValue("notas", e.target.value)}
              placeholder="Observaciones o condiciones..."
              rows={3}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}
