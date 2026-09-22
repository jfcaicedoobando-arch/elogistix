/**
 * Selector de tipo de contenedor (catálogo deduplicado).
 *
 * P1 auditoría v13.824.3: el Select controlado mostraba "Selecciona" tras
 * elegir una opción cuando el ID guardado era un duplicado legacy que no está
 * en la lista visible. Analogía: elegiste una credencial vieja de la misma
 * persona; aquí traducimos ese ID al de la ficha que sí aparece en la lista,
 * así el trigger siempre refleja la selección (mouse y teclado).
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { resolverIdCanonicoTipo } from "@/features/catalogos/utils/tiposContenedorCanonico";

interface Props {
  id?: string;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TipoContenedorSelect({
  id, value, onChange, placeholder = "Selecciona", disabled,
}: Props) {
  const { data: tipos = [] } = useTiposContenedor();

  // Siempre un string estable (el componente permanece controlado): `""`
  // representa "sin selección" y Radix muestra el placeholder.
  const canonico = resolverIdCanonicoTipo(tipos, value);
  const visible = tipos.some((t) => t.id === canonico) ? canonico : "";

  return (
    <Select value={visible} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {tipos.map((t) => (
          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
