import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MODOS = ['Marítimo', 'Aéreo', 'Terrestre', 'Multimodal'];
const TIPOS = ['Importación', 'Exportación', 'Nacional'];
const INCOTERMS = ['EXW', 'FOB', 'CIF', 'DAP', 'DDP', 'FCA', 'CFR', 'CPT', 'CIP', 'DAT'];
const MONEDAS = ['MXN', 'USD', 'EUR'];

interface Props {
  modo: string;
  setModo: (v: string) => void;
  tipo: string;
  setTipo: (v: string) => void;
  incoterm: string;
  setIncoterm: (v: string) => void;
  moneda: string;
  setMoneda: (v: string) => void;
}

export default function SeccionDatosGeneralesCotizacion({ modo, setModo, tipo, setTipo, incoterm, setIncoterm, moneda, setMoneda }: Props) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Datos Generales</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Modo de Transporte</Label>
          <Select value={modo} onValueChange={setModo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MODOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tipo de Operación</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Incoterm</Label>
          <Select value={incoterm} onValueChange={setIncoterm}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{INCOTERMS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Moneda</Label>
          <Select value={moneda} onValueChange={setMoneda}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MONEDAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
