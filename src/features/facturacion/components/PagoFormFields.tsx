import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/shared/NumericInput";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FORMAS_PAGO_SAT } from "@/constants/catalogosSAT";
import { etiquetaCuenta } from "@/features/anticipos-proveedor/domain/etiquetaCuenta";
import { AvisoFechaPreviaCorte } from "@/features/tesoreria/components/AvisoFechaPreviaCorte";

export interface PagoFormValues {
  fecha: string;
  monto: string;
  moneda: string;
  formaPago: string;
  referencia: string;
  notas: string;
  /** Cuenta donde entró el dinero (opcional). "" = no registrar en banco. */
  cuentaBancariaId: string;
}

export interface CuentaCobro {
  id: string;
  alias: string;
  banco: string;
  moneda: string;
  fecha_saldo_inicial: string;
}

interface Props {
  values: PagoFormValues;
  onChange: <K extends keyof PagoFormValues>(k: K, v: PagoFormValues[K]) => void;
  cuentas?: CuentaCobro[];
}

const SIN_CUENTA = "sin-cuenta";

export function PagoFormFields({ values, onChange, cuentas = [] }: Props) {
  const cuentaSel = cuentas.find((c) => c.id === values.cuentaBancariaId) ?? null;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label>Fecha de pago</Label>
        <DatePickerMx value={values.fecha} onChange={(v) => onChange("fecha", v)} className="w-full" />
      </div>
      <div className="space-y-1">
        <Label>Forma de pago</Label>
        <Select value={values.formaPago} onValueChange={(v) => onChange("formaPago", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FORMAS_PAGO_SAT.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="pago-monto">Monto</Label>
        <NumericInput
          aria-label="Monto del pago"
          decimals
          value={Number(values.monto) || 0}
          onChange={(n) => onChange("monto", n === 0 ? "" : String(n))}
          className="h-10 text-right tabular-nums"
        />
      </div>
      <div className="space-y-1">
        <Label>Moneda</Label>
        <Select value={values.moneda} onValueChange={(v) => onChange("moneda", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MXN">MXN</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 space-y-1">
        <Label htmlFor="cobro-cuenta">Cuenta donde entró el dinero (opcional)</Label>
        <Select
          value={values.cuentaBancariaId || SIN_CUENTA}
          onValueChange={(v) => onChange("cuentaBancariaId", v === SIN_CUENTA ? "" : v)}
        >
          <SelectTrigger id="cobro-cuenta"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_CUENTA}>No registrar en banco todavía</SelectItem>
            {cuentas.map((c) => (
              <SelectItem key={c.id} value={c.id}>{etiquetaCuenta(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-label text-muted-foreground">
          {values.cuentaBancariaId
            ? "Se registrará el depósito conciliado en esa cuenta y el saldo subirá."
            : "El cobro entrará al banco cuando concilies el estado de cuenta."}
        </p>
        <AvisoFechaPreviaCorte
          fecha={values.fecha}
          corte={cuentaSel?.fecha_saldo_inicial}
          aliasCuenta={cuentaSel?.alias}
        />
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Referencia</Label>
        <Input value={values.referencia} onChange={(e) => onChange("referencia", e.target.value)}
          placeholder="Folio SPEI, cheque..." />
      </div>
      <div className="col-span-2 space-y-1">
        <Label>Notas</Label>
        <Textarea value={values.notas} onChange={(e) => onChange("notas", e.target.value)} rows={2} />
      </div>
    </div>
  );
}
