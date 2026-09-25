/**
 * Tratamiento de IVA de una línea de concepto.
 *
 * Un solo control para todos los casos: el usuario elige el tratamiento SAT
 * (16%, 8% frontera, 0%, exento, no objeto) y la tasa se deriva de él. No hay
 * interruptor de "IVA apagado" ni tasas sin clasificación fiscal detrás.
 */
import type { TipoIvaSat } from "@/lib/financial/tipoIvaSat";
import { SelectTratamientoIvaFila } from "./SelectTratamientoIvaFila";

interface TratamientoIvaFilaProps {
  tipoIva?: string | null;
  onTipoIvaChange: (tipo: TipoIvaSat) => void;
}

export function TratamientoIvaFila({ tipoIva, onTipoIvaChange }: TratamientoIvaFilaProps) {
  return <SelectTratamientoIvaFila tipoIva={tipoIva} onTipoIvaChange={onTipoIvaChange} />;
}
