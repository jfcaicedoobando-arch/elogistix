import { Input } from "@/components/ui/input";

interface TratamientoIvaFilaProps {
  tipoIva?: string | null;
}

const ETIQUETAS_BLOQUEADAS: Readonly<Record<string, string>> = {
  no_objeto: "No objeto · SAT 01",
  exento: "Exento",
};

export function TratamientoIvaFila({ tipoIva }: TratamientoIvaFilaProps) {
  const etiqueta = tipoIva ? ETIQUETAS_BLOQUEADAS[tipoIva] : undefined;
  if (!etiqueta) return null;

  return (
    <Input
      value={etiqueta}
      readOnly
      aria-label="Tratamiento de IVA"
      className="bg-muted text-body-sm"
    />
  );
}

export function esTratamientoIvaBloqueado(tipoIva?: string | null): boolean {
  return tipoIva === "no_objeto" || tipoIva === "exento";
}