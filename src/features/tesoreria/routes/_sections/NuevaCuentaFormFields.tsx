/**
 * Campos del formulario de alta de cuenta bancaria.
 * Extraído de `TesoreriaCuentas` (límite Power-of-10 de 200 líneas).
 */
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";

import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { useTesoreriaCuentasController, Moneda } from "@/features/tesoreria/hooks/useTesoreriaCuentasController";
import { validarDatosBancarios } from "@/lib/domain/datosBancarios";

type Controller = ReturnType<typeof useTesoreriaCuentasController>;

export interface NuevaCuentaFormFieldsProps {
  form: Controller["form"];
  setField: Controller["setField"];
  /** En edición, si la cuenta ya tiene movimientos no se permite cambiar moneda. */
  monedaBloqueada?: boolean;
}

export function NuevaCuentaFormFields({ form, setField, monedaBloqueada = false }: NuevaCuentaFormFieldsProps) {
  // Ola 11 · RFE-07: aviso inline con la misma regla/mensajes que proveedores.
  const errorClabe = form.clabe
    ? validarDatosBancarios({ esExtranjero: false, clabe: form.clabe, swiftBic: null })?.mensaje ?? null
    : null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <Input
          value={form.clabe}
          onChange={(e) => setField("clabe", e.target.value.replace(/\D/g, "").slice(0, 18))}
          inputMode="numeric"
          maxLength={18}
          placeholder="18 dígitos"
        />
        {errorClabe && (
          <p className="text-xs text-destructive pt-1" role="alert">{errorClabe}</p>
        )}
      </div>
      <div>
        <Label>Moneda</Label>
        <Select value={form.moneda} onValueChange={(v) => setField("moneda", v as Moneda)} disabled={monedaBloqueada}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MXN">MXN</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
          </SelectContent>
        </Select>
        {monedaBloqueada && (
          <p className="text-xs text-muted-foreground pt-1">
            La cuenta ya tiene movimientos: la moneda no se puede cambiar.
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="cuenta-saldo-inicial">Saldo inicial</Label>
        <MoneyInput
          id="cuenta-saldo-inicial"
          value={form.saldoInicial}
          onChange={(n) => setField("saldoInicial", n)}
          currency={form.moneda}
          allowNegative
        />
      </div>

      <div>
        <Label>Saldo inicial al día *</Label>
        <DatePickerMx
          value={form.fechaSaldoInicial}
          onChange={(v) => setField("fechaSaldoInicial", v)}
          className="w-full"
        />
      </div>
      <p className="sm:col-span-2 text-xs text-muted-foreground">
        Los movimientos con fecha anterior a este día se guardan como historial, pero no
        afectan el saldo: ya vienen incluidos en el saldo inicial.
      </p>
    </div>
  );
}
