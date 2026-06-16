import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import SeccionMercanciaWrapper from "./SeccionMercanciaWrapper";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";

interface Props {
  msdsFile: File | null;
  setMsdsFile: (f: File | null) => void;
}

export default function SeccionMercanciaGeneral({ msdsFile, setMsdsFile }: Props) {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();

  return (
    <SeccionMercanciaWrapper msdsFile={msdsFile} setMsdsFile={setMsdsFile}>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="cot-tipo-unidad">Tipo de Unidad</Label>
          <Input
            id="cot-tipo-unidad"
            type="text"
            value={watch("tipoUnidad")}
            onChange={e => setValue("tipoUnidad", e.target.value)}
            placeholder="Ej. Trailer, Caja seca..."
          />
        </div>
        <div>
          <Label htmlFor="cot-peso-kg">Peso (kg)</Label>
          <Input id="cot-peso-kg" type="number" min={0} value={watch("pesoKg")} onChange={e => setValue("pesoKg", Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="cot-volumen-m3">Volumen (m³)</Label>
          <Input id="cot-volumen-m3" type="number" min={0} step={0.01} value={watch("volumenM3")} onChange={e => setValue("volumenM3", Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="cot-piezas">Piezas</Label>
          <Input id="cot-piezas" type="number" min={0} value={watch("piezas")} onChange={e => setValue("piezas", Number(e.target.value))} />
        </div>
      </div>
    </SeccionMercanciaWrapper>
  );
}
