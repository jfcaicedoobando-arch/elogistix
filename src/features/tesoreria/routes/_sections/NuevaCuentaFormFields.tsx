/**
 * Campos del formulario de alta de cuenta bancaria.
 * Extraído de `TesoreriaCuentas` (límite Power-of-10 de 200 líneas).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { useTesoreriaCuentasController, Moneda } from "@/features/tesoreria/hooks/useTesoreriaCuentasController";

type Controller = ReturnType<typeof useTesoreriaCuentasController>;

export interface NuevaCuentaFormFieldsProps {
  form: Controller["form"];
  setField: Controller["setField"];
}

export function NuevaCuentaFormFields({ form, setField }: NuevaCuentaFormFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Banco</Label>
        <Input value={form.banco} onChange={(e) => setField("banco", e.target.value)} />
      </div>
      <div>
        <Label>Alias *</Label>
        <Input value={form.alias} onChange={(e) => setField("alias", e.target.value)} placeholder="BBVA Cheques MXN" />
      </div>
      <div>
        <Label>Número de cuenta</Label>
        <Input value={form.numero} onChange={(e) => setField("numero", e.target.value)} />
      </div>
      <div>
        <Label>CLABE</Label>
        <Input value={form.clabe} onChange={(e) => setField("clabe", e.target.value)} />
      </div>
      <div>
        <Label>Moneda</Label>
        <Select value={form.moneda} onValueChange={(v) => setField("moneda", v as Moneda)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MXN">MXN</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Saldo inicial</Label>
        <Input type="number" step="0.01" value={form.saldoInicial} onChange={(e) => setField("saldoInicial", Number(e.target.value))} />
      </div>
      <div>
        <Label>Saldo inicial al día *</Label>
        <DatePickerMx
          value={form.fechaSaldoInicial}
          onChange={(v) => setField("fechaSaldoInicial", v)}
          className="w-full"
        />
      </div>
      <p className="col-span-2 text-xs text-muted-foreground">
        Los movimientos con fecha anterior a este día se guardan como historial, pero no
        afectan el saldo: ya vienen incluidos en el saldo inicial.
      </p>
    </div>
  );
}
