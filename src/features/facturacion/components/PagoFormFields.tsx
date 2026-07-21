import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/shared/NumericInput";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const FORMAS = ["Transferencia", "Cheque", "Efectivo", "Tarjeta", "Otro"];

export interface PagoFormValues {
  fecha: string;
  monto: string;
  moneda: string;
  formaPago: string;
  referencia: string;
  notas: string;
}

interface Props {
  values: PagoFormValues;
  onChange: <K extends keyof PagoFormValues>(k: K, v: PagoFormValues[K]) => void;
}

export function PagoFormFields({ values, onChange }: Props) {
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
            {FORMAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
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
