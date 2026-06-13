import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UNIDADES_MEDIDA } from "@/constants/wizardConstants";

export function UnidadMedidaSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || 'sin_unidad'} onValueChange={v => onChange(v === 'sin_unidad' ? '' : v)}>
      <SelectTrigger><SelectValue placeholder="Unidad" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="sin_unidad">—</SelectItem>
        {UNIDADES_MEDIDA.map(u => (
          <SelectItem key={u} value={u}>{u}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
