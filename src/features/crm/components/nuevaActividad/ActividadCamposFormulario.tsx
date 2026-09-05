/**
 * Campos principales del formulario de actividad: tipo, fecha, asunto y
 * descripción. Extraído de `NuevaActividadDialog` para mantenerlo compacto.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePickerMx } from "@/components/ui/date-time-picker-mx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ACTIVIDAD_TIPOS, type CrmActividadTipo } from "@/features/crm/hooks";

interface Props {
  tipo: CrmActividadTipo;
  onTipo: (t: CrmActividadTipo) => void;
  fecha: string;
  onFecha: (v: string) => void;
  asunto: string;
  onAsunto: (v: string) => void;
  errorAsunto: boolean;
  desc: string;
  onDesc: (v: string) => void;
}

export default function ActividadCamposFormulario({
  tipo, onTipo, fecha, onFecha, asunto, onAsunto, errorAsunto, desc, onDesc,
}: Props) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => onTipo(v as CrmActividadTipo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVIDAD_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Fecha programada</Label>
          <DateTimePickerMx value={fecha} onChange={onFecha} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="nueva-actividad-asunto" className="flex items-center">
          Asunto<span className="text-destructive ml-0.5">*</span>
        </Label>
        <Input
          id="nueva-actividad-asunto"
          value={asunto}
          onChange={(e) => onAsunto(e.target.value)}
          placeholder="Llamar a cliente, enviar cotización…"
          aria-invalid={errorAsunto ? true : undefined}
          aria-describedby={errorAsunto ? "nueva-actividad-asunto-error" : undefined}
        />
        {errorAsunto && (
          <p id="nueva-actividad-asunto-error" className="text-label text-destructive">
            Escribe el asunto de la actividad.
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label>Descripción</Label>
        <Textarea rows={3} value={desc} onChange={(e) => onDesc(e.target.value)} />
      </div>
    </>
  );
}
