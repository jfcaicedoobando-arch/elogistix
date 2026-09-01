/**
 * Campos de "Servicio" de la solicitud de cotización del portal.
 * Extraído del diálogo para respetar el límite de 200 líneas (Power of 10).
 */
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { MODOS, TIPOS, type ModoTransporte, type TipoOperacion } from "@/constants/wizardConstants";

const TIPOS_EMBARQUE = ["FCL", "LCL", "Aéreo", "Terrestre"] as const;

interface Props {
  modo: ModoTransporte;
  setModo: (v: ModoTransporte) => void;
  tipo: TipoOperacion;
  setTipo: (v: TipoOperacion) => void;
  tipoEmbarque: string;
  setTipoEmbarque: (v: string) => void;
}

export function SolicitudServicioFields({
  modo, setModo, tipo, setTipo, tipoEmbarque, setTipoEmbarque,
}: Props) {
  return (
    <FormDialogSection title="Servicio">
      <div className="space-y-1.5">
        <Label htmlFor="solicitud-modo">Modo de transporte</Label>
        <Select value={modo} onValueChange={(v) => setModo(v as ModoTransporte)}>
          <SelectTrigger id="solicitud-modo"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MODOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="solicitud-tipo">Tipo de operación</Label>
        <Select value={tipo} onValueChange={(v) => setTipo(v as TipoOperacion)}>
          <SelectTrigger id="solicitud-tipo"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="solicitud-embarque">Tipo de embarque</Label>
        <Select value={tipoEmbarque} onValueChange={setTipoEmbarque}>
          <SelectTrigger id="solicitud-embarque"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIPOS_EMBARQUE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </FormDialogSection>
  );
}
