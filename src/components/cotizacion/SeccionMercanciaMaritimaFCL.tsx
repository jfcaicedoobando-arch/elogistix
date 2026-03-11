import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SeccionMercanciaWrapper from "./SeccionMercanciaWrapper";
import type { CotizacionFormValues } from "@/hooks/useCotizacionWizardForm";

const CONTENEDORES_FCL = [
  "20' GP", "20' Dry", "40' Dry", "40' High Cube", "45' High Cube",
  "20' Reefer", "40' Reefer", "20' Open Top", "40' Open Top",
  "20' Flat Rack", "40' Flat Rack",
];

const TIPOS_PESO = ['Peso Normal', 'Sobrepeso'];

interface Props {
  msdsFile: File | null;
  setMsdsFile: (f: File | null) => void;
}

export default function SeccionMercanciaMaritimaFCL({ msdsFile, setMsdsFile }: Props) {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();

  return (
    <SeccionMercanciaWrapper msdsFile={msdsFile} setMsdsFile={setMsdsFile}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Tipo de Contenedor</Label>
          <Select value={watch("tipoContenedor")} onValueChange={v => setValue("tipoContenedor", v)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar contenedor" /></SelectTrigger>
            <SelectContent>
              {CONTENEDORES_FCL.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Peso</Label>
          <Select value={watch("tipoPeso")} onValueChange={v => setValue("tipoPeso", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS_PESO.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
    </SeccionMercanciaWrapper>
  );
}
