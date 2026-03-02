import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload } from "lucide-react";

const TIPOS_CARGA = ['Carga General', 'Mercancía Peligrosa'];
const SECTORES = [
  'Automotriz', 'Médica', 'Alimentos', 'Carga Proyecto',
  'Construcción', 'Industrial', 'General', 'Tecnología', 'Arte y Moda',
];

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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label>Tipo de Carga</Label>
        <Select value={tipoCarga} onValueChange={setTipoCarga}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TIPOS_CARGA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Sector Económico</Label>
        <Select value={sectorEconomico} onValueChange={setSectorEconomico}>
          <SelectTrigger><SelectValue placeholder="Seleccionar sector" /></SelectTrigger>
          <SelectContent>{SECTORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {tipoCarga === 'Mercancía Peligrosa' && (
        <div className="md:col-span-2">
          <Label>Hoja de Seguridad (MSDS)</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
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
      <div className="md:col-span-2">
        <Label>Descripción Adicional</Label>
        <Textarea
          value={descripcionAdicional}
          onChange={e => setDescripcionAdicional(e.target.value)}
          placeholder="Describe aquí más detalles de la mercancía..."
          rows={3}
        />
      </div>
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
  );
}
