import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Ship, StickyNote, Check } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

interface Props {
  form: UseFormReturn<Record<string, unknown>>;
  complete: boolean;
}

/**
 * Bloque "Cierre" del Paso 1 del wizard de cotización.
 * Acordeón con Número de embarques + Notas adicionales.
 * Extraído en v13.142.2 para cumplir el límite Power of 10 de 200 líneas.
 */
export default function SeccionCierreCotizacion({ form, complete }: Props) {
  const tipoEmbarque = form.watch("tipoEmbarque") as string;
  const modo = form.watch("modo") as string;
  // BL-COT-04: el número de contenedores es un dato exclusivo de Marítimo FCL.
  // Antes se pedía también en aéreo/terrestre/multimodal y se guardaba un 1
  // inventado que luego llegaba al embarque.
  const pideContenedores = modo === "Marítimo" && tipoEmbarque === "FCL";
  const errorContenedores = (form.formState.errors.numContenedores?.message ?? null) as string | null;
  const defaultOpen = pideContenedores ? ["num-embarques", "notas"] : ["notas"];
  return (
    <div id="seccion-cierre" className="scroll-mt-4">
      <Accordion type="multiple" defaultValue={defaultOpen} className="w-full">
        {pideContenedores && (
          <AccordionItem value="num-embarques">
            <AccordionTrigger className="text-subsection hover:no-underline">
              <span className="flex items-center gap-2">
                <Ship className="h-5 w-5 text-primary" />
                Número de Embarques
                {complete && (
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
                value={(form.watch("numContenedores") as number) || ""}
                aria-invalid={!!errorContenedores}
                onChange={(e) => {
                  // Sin coerción silenciosa: lo capturado es lo que se guarda y
                  // la validación del paso avisa si falta.
                  const n = parseInt(e.target.value, 10);
                  form.setValue("numContenedores", Number.isFinite(n) && n > 0 ? n : 0, {
                    shouldValidate: true, shouldDirty: true,
                  });
                  form.clearErrors("numContenedores");
                }}
                className="w-32 mt-1"
              />
              {errorContenedores && (
                <p className="text-body-sm text-destructive mt-1">{errorContenedores}</p>
              )}
            </AccordionContent>
          </AccordionItem>
        )}
        <AccordionItem value="notas">
          <AccordionTrigger className="text-subsection hover:no-underline">
            <span className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-primary" />
              Notas Adicionales
            </span>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <Label htmlFor="cot-notas">Notas</Label>
            <Textarea
              id="cot-notas"
              value={form.watch("notas") as string}
              onChange={(e) => form.setValue("notas", e.target.value)}
              placeholder="Observaciones o condiciones…"
              rows={3}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
