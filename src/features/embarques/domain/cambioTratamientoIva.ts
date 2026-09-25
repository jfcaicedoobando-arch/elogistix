/** Deriva tipo, tasa y switch de IVA coherentes desde el tratamiento SAT elegido. */
import { tasaDeTipoIva, type TipoIvaSat } from "@/lib/financial/tipoIvaSat";

export interface CambioTratamientoIva {
  tipoIva: TipoIvaSat;
  tasaIva: number;
  aplicaIva: boolean;
}

export function cambioDesdeTipoIva(tipo: TipoIvaSat): CambioTratamientoIva {
  const tasa = tasaDeTipoIva(tipo);
  return { tipoIva: tipo, tasaIva: tasa ?? 0, aplicaIva: tasa != null && tasa > 0 };
}
