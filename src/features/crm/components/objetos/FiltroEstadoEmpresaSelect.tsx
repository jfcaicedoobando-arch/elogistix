/** Filtro por estado de la empresa ("todos" = sin filtro; Radix no admite valor vacío). */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ESTADOS_EMPRESA_CRM, type FiltroEstadoEmpresa } from "@/features/crm/services/estadoEmpresaCrm";

interface Props { value: FiltroEstadoEmpresa; onChange: (v: FiltroEstadoEmpresa) => void }

export function FiltroEstadoEmpresaSelect({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as FiltroEstadoEmpresa)}>
      <SelectTrigger className="w-44" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los estados</SelectItem>
        {ESTADOS_EMPRESA_CRM.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
