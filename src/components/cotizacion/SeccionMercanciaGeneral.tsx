import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import SeccionMercanciaWrapper from "./SeccionMercanciaWrapper";

interface Props {
  tipoCarga: string;
  setTipoCarga: (v: string) => void;
  sectorEconomico: string;
  setSectorEconomico: (v: string) => void;
  descripcionAdicional: string;
  setDescripcionAdicional: (v: string) => void;
  pesoKg: number;
  setPesoKg: (v: number) => void;
  volumenM3: number;
  setVolumenM3: (v: number) => void;
  piezas: number;
  setPiezas: (v: number) => void;
  msdsFile: File | null;
  setMsdsFile: (f: File | null) => void;
}

export default function SeccionMercanciaGeneral({
  tipoCarga, setTipoCarga,
  sectorEconomico, setSectorEconomico,
  descripcionAdicional, setDescripcionAdicional,
  pesoKg, setPesoKg,
  volumenM3, setVolumenM3,
  piezas, setPiezas,
  msdsFile, setMsdsFile,
}: Props) {
  return (
    <SeccionMercanciaWrapper
      tipoCarga={tipoCarga} setTipoCarga={setTipoCarga}
      sectorEconomico={sectorEconomico} setSectorEconomico={setSectorEconomico}
      descripcionAdicional={descripcionAdicional} setDescripcionAdicional={setDescripcionAdicional}
      msdsFile={msdsFile} setMsdsFile={setMsdsFile}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Peso (kg)</Label>
          <Input type="number" min={0} value={pesoKg} onChange={e => setPesoKg(Number(e.target.value))} />
        </div>
        <div>
          <Label>Volumen (m³)</Label>
          <Input type="number" min={0} step={0.01} value={volumenM3} onChange={e => setVolumenM3(Number(e.target.value))} />
        </div>
        <div>
          <Label>Piezas</Label>
          <Input type="number" min={0} value={piezas} onChange={e => setPiezas(Number(e.target.value))} />
        </div>
      </div>
    </SeccionMercanciaWrapper>
  );
}
