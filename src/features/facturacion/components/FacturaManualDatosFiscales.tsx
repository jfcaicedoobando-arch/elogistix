/**
 * Grid de datos fiscales para `DialogNuevaFacturaManual`.
 * Extraído para mantener el dialog principal < 200 LOC.
 */
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from "@/constants/catalogosSAT";

export interface DatosFiscalesValue {
  serie: string;
  fechaEmision: string;
  diasCredito: number;
  moneda: "MXN" | "USD";
  usoCfdi: string;
  formaPago: string;
  metodoPago: string;
  tipoCambio: number;
}

interface Props {
  value: DatosFiscalesValue;
  onChange: (patch: Partial<DatosFiscalesValue>) => void;
  /** Cuando true, los días de crédito se muestran readonly (source of truth = perfil del cliente). */
  diasReadonly?: boolean;
  diasReadonlyReason?: string;
}

export function FacturaManualDatosFiscales({ value, onChange, diasReadonly, diasReadonlyReason }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div>
        <Label>Serie</Label>
        <Input
          value={value.serie}
          onChange={(e) => onChange({ serie: e.target.value.toUpperCase().slice(0, 5) })}
          maxLength={5}
        />
      </div>
      <div>
        <Label>Fecha emisión</Label>
        <DatePickerMx value={value.fechaEmision} onChange={(v) => onChange({ fechaEmision: v })} className="w-full" />
      </div>
      <div>
        <Label>Días crédito</Label>
        <Input
          type="number" min={0} max={365} value={value.diasCredito}
          onChange={(e) => onChange({ diasCredito: Math.max(0, Number(e.target.value) || 0) })}
          readOnly={diasReadonly}
          disabled={diasReadonly}
          title={diasReadonly ? diasReadonlyReason : undefined}
        />
        {diasReadonly && diasReadonlyReason && (
          <p className="text-[11px] text-muted-foreground mt-1">{diasReadonlyReason}</p>
        )}
      </div>
      <div>
        <Label>Moneda</Label>
        <Select value={value.moneda} onValueChange={(v) => onChange({ moneda: v as "MXN" | "USD" })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MXN">MXN</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Uso CFDI</Label>
        <Select value={value.usoCfdi} onValueChange={(v) => onChange({ usoCfdi: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {USOS_CFDI_SAT.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Forma de pago</Label>
        <Select value={value.formaPago} onValueChange={(v) => onChange({ formaPago: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FORMAS_PAGO_SAT.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Método de pago</Label>
        <Select value={value.metodoPago} onValueChange={(v) => onChange({ metodoPago: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {METODOS_PAGO_SAT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Tipo de cambio</Label>
        <Input
          type="number" step="0.0001" min={0.0001}
          value={value.tipoCambio}
          onChange={(e) => onChange({ tipoCambio: Number(e.target.value) || 1 })}
          disabled={value.moneda === "MXN"}
        />
      </div>
    </div>
  );
}
