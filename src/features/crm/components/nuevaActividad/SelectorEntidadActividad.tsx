/**
 * Selector de entidad (lead u oportunidad) con error accesible.
 * Vive fuera de `NuevaActividadDialog` para mantener el diálogo simple.
 */
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { CrmEntidadTipo } from "@/features/crm/hooks";
import { LeadComboboxCrm, OportunidadComboboxCrm } from "@/features/crm/components/comboboxes/EntidadComboboxCrm";

interface SelectorEntidadProps {
  entidadTipo: CrmEntidadTipo;
  entidadId: string;
  error: boolean;
  onTipo: (t: CrmEntidadTipo) => void;
  onId: (id: string) => void;
}

export default function SelectorEntidadActividad({ entidadTipo, entidadId, error, onTipo, onId }: SelectorEntidadProps) {
  const esLead = entidadTipo === "lead";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label>Tipo de entidad</Label>
        <Select value={entidadTipo} onValueChange={(v) => onTipo(v as CrmEntidadTipo)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="oportunidad">Oportunidad</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="flex items-center">
          {esLead ? "Lead" : "Oportunidad"}
          <span className="text-destructive ml-0.5">*</span>
        </Label>
        <div aria-describedby={error ? "nueva-actividad-entidad-error" : undefined}>
          {esLead ? (
            <LeadComboboxCrm value={entidadId} onChange={onId} />
          ) : (
            <OportunidadComboboxCrm value={entidadId} onChange={onId} />
          )}
        </div>
        {error && (
          <p id="nueva-actividad-entidad-error" className="text-label text-destructive">
            Selecciona {esLead ? "el lead" : "la oportunidad"} a la que pertenece.
          </p>
        )}
      </div>
    </div>
  );
}
