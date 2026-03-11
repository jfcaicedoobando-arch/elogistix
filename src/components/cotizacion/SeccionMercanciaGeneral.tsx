import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import SeccionMercanciaWrapper from "./SeccionMercanciaWrapper";
import type { CotizacionFormValues } from "@/hooks/useCotizacionWizardForm";

interface Props {
  msdsFile: File | null;
  setMsdsFile: (f: File | null) => void;
}

export default function SeccionMercanciaGeneral({ msdsFile, setMsdsFile }: Props) {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();
  const modo = watch("modo");
  const esTerrestre = modo === "Terrestre";

  return (
    <SeccionMercanciaWrapper msdsFile={msdsFile} setMsdsFile={setMsdsFile}>
      {esTerrestre ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Tipo de Unidad</Label>
            <Input
              type="text"
              value={watch("tipoUnidad")}
              onChange={e => setValue("tipoUnidad", e.target.value)}
              placeholder="Ej. Trailer, Caja seca, Plataforma, Rabón..."
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Peso (kg)</Label>
            <Input type="number" min={0} value={watch("pesoKg")} onChange={e => setValue("pesoKg", Number(e.target.value))} />
          </div>
          <div>
            <Label>Volumen (m³)</Label>
            <Input type="number" min={0} step={0.01} value={watch("volumenM3")} onChange={e => setValue("volumenM3", Number(e.target.value))} />
          </div>
          <div>
            <Label>Piezas</Label>
            <Input type="number" min={0} value={watch("piezas")} onChange={e => setValue("piezas", Number(e.target.value))} />
          </div>
        </div>
      )}
    </SeccionMercanciaWrapper>
  );
}
