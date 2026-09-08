/**
 * R219-UI-02 · Campo "Tipo *" de una fila de contenedor.
 *
 * Extraído de `FilaContenedor.tsx` (Power of 10: ≤200 líneas). Mantiene el
 * comportamiento: el valor heredado de la cotización puede ser el UUID del
 * catálogo, así que se inyecta una opción con el valor guardado para que el
 * selector no se pinte vacío ni exponga el identificador.
 */
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TipoContenedor } from "@/features/catalogos/hooks";
import { opcionTipoGuardada } from "@/features/embarques/domain/opcionTipoContenedor";

interface Props {
  id: string;
  value: string;
  tiposContenedor: TipoContenedor[];
  onChange: (tipo: string) => void;
  disabled?: boolean;
}

export function CampoTipoContenedor({
  id,
  value,
  tiposContenedor,
  onChange,
  disabled,
}: Props) {
  const seleccionables = tiposContenedor.filter((ct) => ct.code !== "LCL");
  const opcionGuardada = opcionTipoGuardada(
    value,
    tiposContenedor,
    seleccionables.map((ct) => ct.code),
  );

  return (
    <div className="space-y-1">
      <Label size="sm" htmlFor={id}>Tipo *</Label>
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Seleccionar tipo" />
        </SelectTrigger>
        <SelectContent>
          {opcionGuardada && (
            <SelectItem value={opcionGuardada.value}>{opcionGuardada.label}</SelectItem>
          )}
          {seleccionables.map((ct) => (
            <SelectItem key={ct.code} value={ct.code}>
              {ct.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
