import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";
import type { EmbarqueValidationErrors } from "@/features/embarques/types/embarque";
import { LabelHeredable } from "./LabelHeredable";
import { FieldError, MsdsUploadSection } from "./bloqueMercanciaParts";
import { fieldErrorProps, numberInputProps } from "./bloqueMercanciaHelpers";

interface Props {
  errors: EmbarqueValidationErrors;
  onMsdsUpload: (file: File) => void;
}

export function BloqueMercancia({ errors, onMsdsUpload }: Props) {
  const { register, watch } = useFormContext<EmbarqueFormValues>();
  const tipoCarga = watch("tipoCarga");
  const modo = watch("modo");
  const tipoServicio = watch("tipoServicio");
  const esMaritimo = modo === "Marítimo";
  // Q-3: en marítimo FCL las dimensiones viven por contenedor; sólo se
  // capturan peso/volumen/piezas totales para carga aérea/terrestre o LCL.
  const esFcl = esMaritimo && tipoServicio === "FCL";
  const mostrarDimensiones = !esFcl;

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

      {mostrarDimensiones && (
        <>
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
        </>
      )}
    </div>
  );
}
