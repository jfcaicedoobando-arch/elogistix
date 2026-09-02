/**
 * Campo de motivo para `CierrePeriodoCard`. Sólo se muestra cuando la nueva
 * fecha implica un retroceso (reapertura o vaciado del cierre): la RPC
 * `actualizar_cierre_periodo` exige un motivo de al menos 10 caracteres en
 * ese caso (Ola 3 · Defecto 4).
 */
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/FormField";

export const MOTIVO_MIN_LARGO = 10;

interface CierrePeriodoMotivoFieldProps {
  motivo: string;
  onChange: (valor: string) => void;
  error?: string;
}

export function CierrePeriodoMotivoField({ motivo, onChange, error }: CierrePeriodoMotivoFieldProps) {
  return (
    <div className="max-w-md">
      <FormField
        label="Motivo del retroceso"
        required
        hint={`Mínimo ${MOTIVO_MIN_LARGO} caracteres`}
        error={error}
      >
        <Textarea
          value={motivo}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Explica por qué se reabre o retrocede el periodo cerrado"
          rows={3}
        />
      </FormField>
    </div>
  );
}
