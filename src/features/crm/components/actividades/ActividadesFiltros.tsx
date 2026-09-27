import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTIVIDAD_TIPOS } from "@/features/crm/hooks";
import { ACTIVIDAD_TIPO_LABEL } from "@/features/crm/domain/actividadLabels";

interface Props {
  filters: { tipo: string; estado: string; responsable: string };
  onChange: (key: "tipo" | "estado" | "responsable", value: string) => void;
}

export function ActividadesFiltros({ filters, onChange }: Props) {
  const id = useId();
  return <>
    <div className="space-y-1">
      <Label htmlFor={`${id}-tipo`}>Tipo</Label>
      <Select value={filters.tipo} onValueChange={v => onChange("tipo", v)}>
        <SelectTrigger id={`${id}-tipo`} className="h-9 w-full md:w-[140px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los tipos</SelectItem>
          {ACTIVIDAD_TIPOS.map(t => <SelectItem key={t} value={t}>{ACTIVIDAD_TIPO_LABEL[t]}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <div className="space-y-1">
      <Label htmlFor={`${id}-estado`}>Estado</Label>
      <Select value={filters.estado} onValueChange={v => onChange("estado", v)}>
        <SelectTrigger id={`${id}-estado`} className="h-9 w-full md:w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="pendientes">Pendientes</SelectItem>
          <SelectItem value="completadas">Completadas</SelectItem>
          <SelectItem value="todas">Todas</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="space-y-1">
      <Label htmlFor={`${id}-responsable`}>Responsable</Label>
      <Select value={filters.responsable} onValueChange={v => onChange("responsable", v)}>
        <SelectTrigger id={`${id}-responsable`} className="h-9 w-full md:w-[220px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los responsables</SelectItem>
          <SelectItem value="mias">Mis actividades</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </>;
}
