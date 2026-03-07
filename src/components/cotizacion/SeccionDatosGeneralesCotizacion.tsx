import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CotizacionFormValues } from "@/hooks/useCotizacionWizardForm";

const MODOS = ['Marítimo', 'Aéreo', 'Terrestre', 'Multimodal'];
const TIPOS = ['Importación', 'Exportación', 'Nacional', 'Cross Trade'];
const INCOTERMS = ['EXW', 'FOB', 'CIF', 'DAP', 'DDP', 'FCA', 'CFR', 'CPT', 'CIP', 'DAT'];

export default function SeccionDatosGeneralesCotizacion() {
  const { watch, setValue } = useFormContext<CotizacionFormValues>();

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Datos Generales</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Modo de Transporte</Label>
          <Select value={watch("modo")} onValueChange={v => setValue("modo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MODOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tipo de Operación</Label>
          <Select value={watch("tipo")} onValueChange={v => setValue("tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Incoterm</Label>
          <Select value={watch("incoterm")} onValueChange={v => setValue("incoterm", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{INCOTERMS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
