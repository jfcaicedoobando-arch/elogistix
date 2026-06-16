import { Upload, FileText } from "lucide-react";
import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";
import type { EmbarqueValidationErrors } from "@/features/embarques/types/embarque";
import { LabelHeredable } from "./LabelHeredable";

interface Props {
  errors: EmbarqueValidationErrors;
  onMsdsUpload: (file: File) => void;
}

export function BloqueMercancia({ errors, onMsdsUpload }: Props) {
  const { register, watch } = useFormContext<EmbarqueFormValues>();
  const tipoCarga = watch('tipoCarga');
  const msdsArchivo = watch('msdsArchivo');
  const subiendoMsds = watch('subiendoMsds');
  const msdsNombreArchivo = msdsArchivo ? msdsArchivo.split('/').pop() : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2 md:col-span-2">
        <LabelHeredable field="descripcionMercancia" getter={(c) => c.descripcion_mercancia} htmlFor="emb-descripcion-mercancia">
          Descripción de la Mercancía *
        </LabelHeredable>
        <Input id="emb-descripcion-mercancia" className={errors.descripcionMercancia ? 'border-destructive' : ''} placeholder="Descripción detallada" {...register('descripcionMercancia')} />
        {errors.descripcionMercancia && <p className="text-xs text-destructive">{errors.descripcionMercancia}</p>}
      </div>
      <div className="space-y-2">
        <LabelHeredable field="tipoCarga" getter={(c) => c.tipo_carga} htmlFor="emb-tipo-carga">Tipo de Carga *</LabelHeredable>
        <Controller name="tipoCarga" render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id="emb-tipo-carga"><SelectValue placeholder="Seleccionar tipo de carga" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Carga General">Carga General</SelectItem>
              <SelectItem value="Mercancía Peligrosa">Mercancía Peligrosa</SelectItem>
            </SelectContent>
          </Select>
        )} />
      </div>
      {tipoCarga === 'Mercancía Peligrosa' && (
        <div className="space-y-2">
          <Label htmlFor="msds-file-input">Hoja de Seguridad (MSDS)</Label>
          {msdsNombreArchivo ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" aria-hidden />
              <span className="truncate">{msdsNombreArchivo}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('msds-file-input')?.click()}>Cambiar</Button>
            </div>
          ) : (
            <Button type="button" variant="outline" className="w-full" disabled={subiendoMsds} onClick={() => document.getElementById('msds-file-input')?.click()}>
              <Upload className="h-4 w-4 mr-2" aria-hidden />
              {subiendoMsds ? 'Subiendo...' : 'Adjuntar MSDS'}
            </Button>
          )}
          <input id="msds-file-input" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
            onChange={(e) => { const archivo = e.target.files?.[0]; if (archivo) onMsdsUpload(archivo); e.target.value = ''; }} />
        </div>
      )}
      <div className="space-y-2">
        <LabelHeredable field="pesoKg" getter={(c) => String(c.peso_kg || "")} htmlFor="emb-peso-kg">Peso (kg) *</LabelHeredable>
        <Input id="emb-peso-kg" type="number" placeholder="0" {...register('pesoKg')} />
      </div>
      <div className="space-y-2">
        <LabelHeredable field="volumenM3" getter={(c) => String(c.volumen_m3 || "")} htmlFor="emb-volumen-m3">Volumen (m³) *</LabelHeredable>
        <Input id="emb-volumen-m3" type="number" placeholder="0" {...register('volumenM3')} />
      </div>
      <div className="space-y-2">
        <LabelHeredable field="piezas" getter={(c) => String(c.piezas || "")} htmlFor="emb-piezas">Piezas *</LabelHeredable>
        <Input id="emb-piezas" type="number" placeholder="0" {...register('piezas')} />
      </div>
    </div>
  );
}
