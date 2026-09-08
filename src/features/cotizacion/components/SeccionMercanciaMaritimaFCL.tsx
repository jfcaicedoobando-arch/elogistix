import { useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SeccionMercanciaWrapper from "./SeccionMercanciaWrapper";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";
import { TIPOS_CONTENEDOR_DEFAULT } from "@/features/cotizacion/domain/tiposContenedorDefault";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { opcionTipoGuardada } from "@/features/embarques/domain/opcionTipoContenedor";

const TIPOS_PESO = ['Peso Normal', 'Sobrepeso'];

interface Props {
  msdsFile: File | null;
  setMsdsFile: (f: File | null) => void;
}

export default function SeccionMercanciaMaritimaFCL({ msdsFile, setMsdsFile }: Props) {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();
  const { data: tiposContenedor = [] } = useTiposContenedor();
  const tipoContenedor = watch("tipoContenedor");
  // R219-UI-02: al aplicar una tarifa el campo guarda el UUID del catálogo, que
  // no está en la lista de nombres; sin esta opción el selector se veía vacío.
  const opcionGuardada = opcionTipoGuardada(
    tipoContenedor,
    tiposContenedor,
    TIPOS_CONTENEDOR_DEFAULT,
  );

  return (
    <SeccionMercanciaWrapper msdsFile={msdsFile} setMsdsFile={setMsdsFile}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Tipo de Contenedor</Label>
          <Select value={tipoContenedor || undefined} onValueChange={v => setValue("tipoContenedor", v)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar contenedor" /></SelectTrigger>
            <SelectContent>
              {opcionGuardada && (
                <SelectItem value={opcionGuardada.value}>{opcionGuardada.label}</SelectItem>
              )}
              {TIPOS_CONTENEDOR_DEFAULT.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
