import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UNIDADES_MEDIDA } from "@/constants/wizardConstants";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function UnidadMedidaSelect({ value, onChange }: Props) {
  // VIS-CE-251-08: valores legacy guardados fuera del catálogo vigente
  // (p. ej. `E48`) se muestran como opción adicional para no perder el dato
  // al editar; no se inventa ninguna equivalencia.
  const esLegacy = value !== '' && !UNIDADES_MEDIDA.includes(value as typeof UNIDADES_MEDIDA[number]);
  return (
    <Select value={value || 'sin_unidad'} onValueChange={(v) => onChange(v === 'sin_unidad' ? '' : v)}>
      <SelectTrigger aria-label="Unidad de medida"><SelectValue placeholder="Unidad" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="sin_unidad">—</SelectItem>
        {esLegacy && <SelectItem value={value}>{value}</SelectItem>}
        {UNIDADES_MEDIDA.map(u => (
          <SelectItem key={u} value={u}>{u}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
