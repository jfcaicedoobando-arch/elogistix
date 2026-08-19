/**
 * Bloque R — Campos principales del formulario de póliza: aseguradora,
 * número de póliza, vigencia, moneda y prima.
 */
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MonedaSeguro, SeguroEmbarqueInput } from "@/features/embarques/services/seguros";

type FormState = Omit<SeguroEmbarqueInput, "embarque_id">;

interface Props {
  form: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}

export function SeguroFormCamposPrincipales({ form, setField }: Props) {
  return (
    <>
      <div>
        <Label htmlFor="seguro-aseguradora">Aseguradora *</Label>
        <Input id="seguro-aseguradora" value={form.aseguradora} onChange={(e) => setField("aseguradora", e.target.value)} />
      </div>
      <div>
        <Label htmlFor="seguro-poliza">Número de póliza *</Label>
        <Input id="seguro-poliza" value={form.numero_poliza} onChange={(e) => setField("numero_poliza", e.target.value)} />
      </div>

      <div>
        <Label htmlFor="seguro-vigencia-desde">Vigencia desde *</Label>
        <DatePickerMx id="seguro-vigencia-desde" value={form.vigencia_desde} onChange={(v) => setField("vigencia_desde", v)} className="w-full" />
      </div>
      <div>
        <Label htmlFor="seguro-vigencia-hasta">Vigencia hasta *</Label>
        <DatePickerMx id="seguro-vigencia-hasta" value={form.vigencia_hasta} onChange={(v) => setField("vigencia_hasta", v)} className="w-full" />
        {form.vigencia_hasta < form.vigencia_desde && (
          <p className="text-body-sm text-destructive mt-1">La vigencia final es anterior a la inicial.</p>
        )}
      </div>

      <div>
        <Label htmlFor="seguro-moneda">Moneda</Label>
        <Select value={form.moneda} onValueChange={(v) => setField("moneda", v as MonedaSeguro)}>
          <SelectTrigger id="seguro-moneda"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MXN">MXN</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="seguro-prima">Prima (costo) *</Label>
        <Input id="seguro-prima" type="number" min={0} step={0.01} value={form.prima}
          onChange={(e) => setField("prima", Number(e.target.value))} />
        {form.prima < 0 && (
          <p className="text-body-sm text-destructive mt-1">La prima no puede ser negativa.</p>
        )}
      </div>
    </>
  );
}
