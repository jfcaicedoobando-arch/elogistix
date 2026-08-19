import { ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Upload } from "lucide-react";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";
import { TIPOS_CARGA, SECTORES } from "@/constants/cotizacionMercancia";

interface Props {
  msdsFile: File | null;
  setMsdsFile: (f: File | null) => void;
  children?: ReactNode;
}

export default function SeccionMercanciaWrapper({
  msdsFile, setMsdsFile,
  children,
}: Props) {
  const { watch, setValue, clearErrors, formState: { errors } } = useFormContext<CotizacionFormValues>();
  const tipoCarga = watch("tipoCarga");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Tipo de carga" required>
          <Select value={tipoCarga} onValueChange={v => setValue("tipoCarga", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS_CARGA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Sector económico">
          <Select value={watch("sectorEconomico")} onValueChange={v => setValue("sectorEconomico", v)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar sector" /></SelectTrigger>
            <SelectContent>{SECTORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
      </div>

      {/* B-035: descripción real de la mercancía (antes se persistía el sector). */}
      {/* VF-18: asterisco con el patrón estándar de FormField (sin espacio manual). */}
      <FormField label="Descripción de la mercancía" required error={errors.descripcionMercancia?.message}>
        <Input
          value={watch("descripcionMercancia")}
          onChange={e => {
            setValue("descripcionMercancia", e.target.value, { shouldValidate: true, shouldDirty: true });
            clearErrors("descripcionMercancia");
          }}
          placeholder="Ej. Pallets de refacciones automotrices"
        />
      </FormField>

      {children}

      <Accordion type="multiple" className="w-full">
        <AccordionItem value="descripcion-adicional" className="border-b-0">
          <AccordionTrigger className="text-sm font-medium py-2 hover:no-underline">
            Descripción Adicional
          </AccordionTrigger>
          <AccordionContent>
            <Textarea
              value={watch("descripcionAdicional")}
              onChange={e => setValue("descripcionAdicional", e.target.value)}
              placeholder="Describe aquí más detalles de la mercancía..."
              rows={3}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {tipoCarga === 'Mercancía Peligrosa' && (
        <div>
          <Label htmlFor="msds-file-input">Hoja de Seguridad (MSDS)</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              id="msds-file-input"
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.png"
              onChange={e => setMsdsFile(e.target.files?.[0] || null)}
            />
            {msdsFile && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Upload className="h-3 w-3" /> {msdsFile.name}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}