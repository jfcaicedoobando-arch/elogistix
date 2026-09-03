/**
 * Selects primarios (estado y fuente) del listado de leads.
 * Extraído de `Leads.tsx` (Power of 10 #1: archivos ≤200 líneas).
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LEAD_ESTADOS_ETAPA_LEAD } from "@/features/crm/domain/leads/etapas";
import { LEAD_FUENTES } from "@/features/crm/domain/leads/constants";

interface Props {
  estado: string;
  fuente: string;
  onChange: (key: "estado" | "fuente", value: string) => void;
}

export default function LeadsFiltrosPrimarios({ estado, fuente, onChange }: Props) {
  return (
    <>
      <Select value={estado} onValueChange={(v) => onChange("estado", v)}>
        <SelectTrigger className="h-9 w-auto min-w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los estados</SelectItem>
          {LEAD_ESTADOS_ETAPA_LEAD.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={fuente} onValueChange={(v) => onChange("fuente", v)}>
        <SelectTrigger className="h-9 w-auto min-w-[160px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas las fuentes</SelectItem>
          {LEAD_FUENTES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
        </SelectContent>
      </Select>
    </>
  );
}
