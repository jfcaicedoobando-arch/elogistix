/**
 * Selector de cuenta bancaria usado por el modal de traspasos.
 * Extraído de `DialogTraspasoCuentas.tsx` (límite Power-of-10 de 200 líneas).
 */
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

type Cuenta = Tables<"cuentas_bancarias">;

export interface TraspasoCuentaSelectProps {
  id: string;
  label: string;
  cuentas: Cuenta[];
  value: string;
  onChange: (value: string) => void;
}

export function TraspasoCuentaSelect({ id, label, cuentas, value, onChange }: TraspasoCuentaSelectProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={`Selecciona ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {cuentas.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.banco} {c.alias} ({c.moneda})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
