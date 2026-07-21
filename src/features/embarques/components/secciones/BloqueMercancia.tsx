import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";
import type { EmbarqueValidationErrors } from "@/features/embarques/types/embarque";
import { LabelHeredable } from "./LabelHeredable";
import { FieldError, MsdsUploadSection, fieldErrorProps, numberInputProps } from "./bloqueMercanciaParts";

interface Props {
  errors: EmbarqueValidationErrors;
  onMsdsUpload: (file: File) => void;
}

export function BloqueMercancia({ errors, onMsdsUpload }: Props) {
  const { register, watch } = useFormContext<EmbarqueFormValues>();
  const tipoCarga = watch("tipoCarga");
  const modo = watch("modo");
  const contenedores = (watch("contenedores") ?? []) as ContenedorBorrador[];
  const esMaritimo = modo === "Marítimo";

  const totales = esMaritimo
    ? contenedores.reduce(
        (acc, c) => ({
          peso: acc.peso + (Number(c.peso_kg) || 0),
          volumen: acc.volumen + (Number(c.volumen_m3) || 0),
          piezas: acc.piezas + (Number(c.piezas) || 0),
        }),
        { peso: 0, volumen: 0, piezas: 0 },
      )
    : null;
  const hayContenedoresConDatos =
    esMaritimo && totales !== null && (totales.peso > 0 || totales.volumen > 0 || totales.piezas > 0);

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

      {esMaritimo ? (
        <div className="md:col-span-2 rounded-md border border-dashed bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Calculator className="h-3.5 w-3.5" aria-hidden />
            Totales calculados desde contenedores
          </div>
          {hayContenedoresConDatos ? (
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
              <span><span className="font-semibold">{formatNumber(totales!.peso)}</span> kg</span>
              <span><span className="font-semibold">{formatNumber(totales!.volumen, { decimals: 2 })}</span> m³</span>
              <span><span className="font-semibold">{formatNumber(totales!.piezas)}</span> piezas</span>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Captura peso, volumen y piezas por contenedor en el paso 2 (Ruta). Los totales del embarque se calculan automáticamente.
            </p>
          )}
        </div>
      ) : (
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
