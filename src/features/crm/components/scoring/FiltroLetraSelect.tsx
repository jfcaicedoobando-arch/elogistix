/** Filtro por letra de puntaje ("todas" = sin filtro; Radix no admite valor vacío). */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LETRAS_PUNTAJE } from "@/features/crm/services/scoring/scoringCrm";

interface Props { value: string; onChange: (v: string) => void }

export function FiltroLetraSelect({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48" aria-label="Filtrar por puntaje"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="todas">Todos los puntajes</SelectItem>
        {LETRAS_PUNTAJE.map((l) => <SelectItem key={l} value={l}>Puntaje {l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
