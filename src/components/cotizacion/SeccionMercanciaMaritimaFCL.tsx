import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload } from "lucide-react";

const CONTENEDORES_FCL = [
  "20' Dry", "40' Dry", "40' High Cube", "45' High Cube",
  "20' Reefer", "40' Reefer", "20' Open Top", "40' Open Top",
  "20' Flat Rack", "40' Flat Rack",
];

const TIPOS_CARGA = ['Carga General', 'Mercancía Peligrosa'];
const SECTORES = [
  'Automotriz', 'Médica', 'Alimentos', 'Carga Proyecto',
  'Construcción', 'Industrial', 'General', 'Tecnología', 'Arte y Moda',
];
const TIPOS_PESO = ['Peso Normal', 'Sobrepeso'];

interface Props {
  tipoContenedor: string;
  setTipoContenedor: (v: string) => void;
  tipoCarga: string;
  setTipoCarga: (v: string) => void;
  sectorEconomico: string;
  setSectorEconomico: (v: string) => void;
  descripcionAdicional: string;
  setDescripcionAdicional: (v: string) => void;
  tipoPeso: string;
  setTipoPeso: (v: string) => void;
  msdsFile: File | null;
  setMsdsFile: (f: File | null) => void;
}

export default function SeccionMercanciaMaritimaFCL({
  tipoContenedor, setTipoContenedor,
  tipoCarga, setTipoCarga,
  sectorEconomico, setSectorEconomico,
  descripcionAdicional, setDescripcionAdicional,
  tipoPeso, setTipoPeso,
  msdsFile, setMsdsFile,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label>Tipo de Contenedor</Label>
        <Select value={tipoContenedor} onValueChange={setTipoContenedor}>
          <SelectTrigger><SelectValue placeholder="Seleccionar contenedor" /></SelectTrigger>
          <SelectContent>
            {CONTENEDORES_FCL.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
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
      <div>
        <Label>Peso</Label>
        <Select value={tipoPeso} onValueChange={setTipoPeso}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TIPOS_PESO.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label>Descripción Adicional</Label>
        <Textarea
          value={descripcionAdicional}
          onChange={e => setDescripcionAdicional(e.target.value)}
          placeholder="Describe aquí más detalles de la mercancía..."
          rows={3}
        />
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
    </div>
  );
}
