/**
 * Select para asignar un concepto (venta/costo) a un contenedor del embarque.
 *
 * v12.6.0 — Devuelve `null` cuando el usuario elige "General". Se oculta
 * automáticamente si el embarque tiene 0 o 1 contenedores (no aporta valor).
 *
 * Radix Select no acepta value="" → usamos el centinela 'generales'.
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useContenedoresEmbarque } from "@/hooks/embarque";

const GENERAL_VALUE = 'generales';

interface Props {
  embarqueId: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export function SelectContenedorConcepto({
  embarqueId, value, onChange, disabled, className,
}: Props) {
  const { data: contenedores = [], isLoading } = useContenedoresEmbarque(embarqueId);

  // No mostrar selector si no hay al menos 2 contenedores (no aporta valor)
  if (!isLoading && contenedores.length < 2) return null;

  return (
    <Select
      value={value ?? GENERAL_VALUE}
      onValueChange={(v) => onChange(v === GENERAL_VALUE ? null : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="Contenedor" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={GENERAL_VALUE}>General (todo el embarque)</SelectItem>
        {contenedores.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.numero_contenedor || `Contenedor ${c.orden}`}
            {c.tipo_contenedor ? ` — ${c.tipo_contenedor}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
