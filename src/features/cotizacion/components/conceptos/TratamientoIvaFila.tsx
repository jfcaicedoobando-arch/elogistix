import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { TASAS_IVA_MX } from "@/lib/financial/financialUtils";

interface TratamientoIvaFilaProps {
  tipoIva?: string | null;
  tasa: number;
  onTasaChange: (tasa: number) => void;
}

const ETIQUETAS_BLOQUEADAS: Readonly<Record<string, string>> = {
  no_objeto: "No objeto · SAT 01",
  exento: "Exento",
};

export function TratamientoIvaFila({ tipoIva, tasa, onTasaChange }: TratamientoIvaFilaProps) {
  const etiqueta = tipoIva ? ETIQUETAS_BLOQUEADAS[tipoIva] : undefined;
  if (!etiqueta) {
    return (
      <Select value={String(tasa)} onValueChange={(value) => onTasaChange(Number(value))}>
        <SelectTrigger className="h-10" aria-label="Tasa de IVA">
          {Math.round(tasa * 100)}%
        </SelectTrigger>
        <SelectContent>
          {TASAS_IVA_MX.map((opcion) => (
            <SelectItem key={opcion.value} value={String(opcion.value)}>{opcion.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      value={etiqueta}
      readOnly
      aria-label="Tratamiento de IVA"
      className="bg-muted text-body-sm"
    />
  );
}
