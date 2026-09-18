/**
 * Tratamiento de IVA de una línea de concepto.
 *
 * Tres estados posibles, ninguno inferido:
 *  1. `exento` / `no_objeto` → etiqueta fija (no hay tasa que elegir).
 *  2. tipo no reconocido (o ausente) → "Tratamiento fiscal por definir", con la
 *     acción para clasificarlo. El timbrado ya lo bloquea (P1-IVA); aquí se
 *     avisa antes en vez de mostrar una tasa como si estuviera resuelta.
 *  3. gravado / tasa 0% → selector de tasa (con la protección del 8%).
 */
import { Input } from "@/components/ui/input";
import { esTipoIvaSat, type TipoIvaSat } from "@/lib/financial/tipoIvaSat";
import { TasaIvaSelect } from "./TasaIvaSelect";
import { TratamientoIvaPorDefinir } from "./TratamientoIvaPorDefinir";

interface TratamientoIvaFilaProps {
  tipoIva?: string | null;
  tasa: number;
  onTasaChange: (tasa: number) => void;
  /** Clasificación explícita de una línea sin tratamiento reconocido. */
  onTipoIvaChange?: (tipo: TipoIvaSat) => void;
}

const ETIQUETAS_BLOQUEADAS: Readonly<Record<string, string>> = {
  no_objeto: "No objeto · SAT 01",
  exento: "Exento",
};

export function TratamientoIvaFila({
  tipoIva,
  tasa,
  onTasaChange,
  onTipoIvaChange,
}: TratamientoIvaFilaProps) {
  const etiqueta = tipoIva ? ETIQUETAS_BLOQUEADAS[tipoIva] : undefined;
  if (etiqueta) {
    return (
      <Input
        value={etiqueta}
        readOnly
        aria-label="Tratamiento de IVA"
        className="bg-muted text-body-sm"
      />
    );
  }

  if (!esTipoIvaSat(tipoIva) && onTipoIvaChange) {
    return <TratamientoIvaPorDefinir onTipoIvaChange={onTipoIvaChange} />;
  }

  return <TasaIvaSelect tasa={tasa} onTasaChange={onTasaChange} />;
}
