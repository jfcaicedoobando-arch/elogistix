import { Upload, FileText } from "lucide-react";
import { useFormContext, Controller } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";
import type { EmbarqueValidationErrors } from "@/features/embarques/types/embarque";
import { LabelHeredable } from "./LabelHeredable";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fieldErrorProps(error?: string) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    className: cn(error && "border-destructive"),
  };
}

function numberInputProps(error?: string) {
  return {
    "aria-invalid": error ? (true as const) : undefined,
    className: cn(
      error && "border-destructive",
      "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    ),
  };
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}

// ── MsdsUploadSection ──────────────────────────────────────────────────────────

interface MsdsProps {
  onMsdsUpload: (file: File) => void;
}

function MsdsUploadSection({ onMsdsUpload }: MsdsProps) {
  const { watch } = useFormContext<EmbarqueFormValues>();
  const msdsArchivo = watch("msdsArchivo");
  const subiendoMsds = watch("subiendoMsds");
  const msdsNombreArchivo = msdsArchivo ? msdsArchivo.split("/").pop() : null;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (archivo) onMsdsUpload(archivo);
    e.target.value = "";
  }

  function openPicker() {
    document.getElementById("msds-file-input")?.click();
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="msds-file-input">Hoja de Seguridad (MSDS)</Label>
      {msdsNombreArchivo ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" aria-hidden />
          <span className="truncate">{msdsNombreArchivo}</span>
          <Button type="button" variant="outline" size="sm" onClick={openPicker}>
            Cambiar
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full" disabled={subiendoMsds} onClick={openPicker}>
          <Upload className="h-4 w-4 mr-2" aria-hidden />
          {subiendoMsds ? "Subiendo..." : "Adjuntar MSDS"}
        </Button>
      )}
      <input
        id="msds-file-input"
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

// ── BloqueMercancia ────────────────────────────────────────────────────────────

interface Props {
  errors: EmbarqueValidationErrors;
  onMsdsUpload: (file: File) => void;
}

export function BloqueMercancia({ errors, onMsdsUpload }: Props) {
  const { register, watch } = useFormContext<EmbarqueFormValues>();
  const tipoCarga = watch("tipoCarga");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2 md:col-span-2">
        <LabelHeredable field="descripcionMercancia" getter={(c) => c.descripcion_mercancia} htmlFor="emb-descripcion-mercancia">
          Descripción de la Mercancía *
        </LabelHeredable>
        <Input
          id="emb-descripcion-mercancia"
          placeholder="Descripción detallada"
          {...fieldErrorProps(errors.descripcionMercancia)}
          {...register("descripcionMercancia")}
        />
        <FieldError msg={errors.descripcionMercancia} />
      </div>

      <div className="space-y-2">
        <LabelHeredable field="tipoCarga" getter={(c) => c.tipo_carga} htmlFor="emb-tipo-carga">
          Tipo de Carga *
        </LabelHeredable>
        <Controller
          name="tipoCarga"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="emb-tipo-carga" {...fieldErrorProps(errors.tipoCarga)}>
                <SelectValue placeholder="Seleccionar tipo de carga" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Carga General">Carga General</SelectItem>
                <SelectItem value="Mercancía Peligrosa">Mercancía Peligrosa</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        <FieldError msg={errors.tipoCarga} />
      </div>

      {tipoCarga === "Mercancía Peligrosa" && <MsdsUploadSection onMsdsUpload={onMsdsUpload} />}

      <div className="space-y-2">
        <LabelHeredable field="pesoKg" getter={(c) => String(c.peso_kg || "")} htmlFor="emb-peso-kg">
          Peso (kg) *
        </LabelHeredable>
        <Input id="emb-peso-kg" type="number" placeholder="0" {...numberInputProps(errors.pesoKg)} {...register("pesoKg")} />
        <FieldError msg={errors.pesoKg} />
      </div>

      <div className="space-y-2">
        <LabelHeredable field="volumenM3" getter={(c) => String(c.volumen_m3 || "")} htmlFor="emb-volumen-m3">
          Volumen (m³) *
        </LabelHeredable>
        <Input id="emb-volumen-m3" type="number" placeholder="0" {...numberInputProps(errors.volumenM3)} {...register("volumenM3")} />
        <FieldError msg={errors.volumenM3} />
      </div>

      <div className="space-y-2">
        <LabelHeredable field="piezas" getter={(c) => String(c.piezas || "")} htmlFor="emb-piezas">
          Piezas *
        </LabelHeredable>
        <Input id="emb-piezas" type="number" placeholder="0" {...numberInputProps(errors.piezas)} {...register("piezas")} />
        <FieldError msg={errors.piezas} />
      </div>
    </div>
  );
}
