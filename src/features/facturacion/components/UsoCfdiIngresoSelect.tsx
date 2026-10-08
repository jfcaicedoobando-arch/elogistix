import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { USOS_CFDI_SAT } from "@/constants/catalogosSAT";
import { USOS_CFDI_INGRESO, validarUsoCfdiIngreso } from "@/lib/financial/usoCfdiFiscal";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Sin receptor aún (captura de borrador), sólo filtra usos de ingreso. */
  receptor?: { rfc: string; regimen: string };
}

/** Conserva a la vista la selección heredada inválida sin ofrecerla ni reemplazarla. */
export function UsoCfdiIngresoSelect({ value, onChange, receptor }: Props) {
  const id = useId();
  const opciones = USOS_CFDI_SAT.filter((o) => USOS_CFDI_INGRESO.includes(o.value))
    .filter((o) => !receptor || validarUsoCfdiIngreso({ ...receptor, usoCfdi: o.value }).length === 0);
  const error = receptor
    ? validarUsoCfdiIngreso({ ...receptor, usoCfdi: value }).map((i) => i.message).join(" ")
    : value && !USOS_CFDI_INGRESO.includes(value) ? `El uso ${value} no es válido para una factura de ingreso CFDI 4.0.` : "";
  const etiqueta = USOS_CFDI_SAT.find((o) => o.value === value)?.label ?? value;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Uso CFDI</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}>
          <SelectValue placeholder="Elige un uso compatible">{etiqueta || undefined}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {opciones.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {error && <p id={`${id}-error`} role="alert" className="text-label text-destructive">{error}</p>}
    </div>
  );
}
