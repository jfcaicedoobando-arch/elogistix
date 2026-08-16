/**
 * Metas comerciales y riesgo del negocio (mapeo del CRM Hunter):
 * monto meta, fecha meta, compromiso, margen esperado y riesgos/objeciones.
 * Vive aparte de `OportunidadFormFields` para respetar Power of 10 (≤200 líneas).
 */
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OportunidadFormState } from "@/features/crm/hooks";

interface Props {
  form: OportunidadFormState;
  set: <K extends keyof OportunidadFormState>(k: K, v: OportunidadFormState[K]) => void;
}

export default function OportunidadMetasFields({ form, set }: Props) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="op-monto-meta">Monto meta</Label>
        <MoneyInput
          id="op-monto-meta"
          value={form.monto_meta}
          currency={form.moneda}
          onChange={(n: number) => set("monto_meta", n)}
        />
      </div>
      <div className="space-y-1">
        <Label>Fecha meta de cierre</Label>
        <DatePickerMx
          value={form.fecha_meta_cierre}
          onChange={(v) => set("fecha_meta_cierre", v)}
          className="w-full"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="op-margen-pct">Margen esperado (%)</Label>
        <Input
          id="op-margen-pct"
          type="number"
          min={0}
          max={100}
          step="0.1"
          value={form.margen_pct}
          onChange={(e) =>
            set("margen_pct", Math.max(0, Math.min(100, Number(e.target.value) || 0)))
          }
        />
      </div>
      <div className="sm:col-span-2 space-y-1">
        <Label>Compromiso con el cliente</Label>
        <Textarea
          rows={2}
          value={form.compromiso_nota}
          onChange={(e) => set("compromiso_nota", e.target.value)}
          placeholder="Ej. Enviar propuesta FCL Shanghái–Manzanillo antes del cierre de mes"
        />
      </div>
      <div className="sm:col-span-2 space-y-1">
        <Label>Riesgos / objeciones</Label>
        <Textarea
          rows={2}
          value={form.riesgos_objeciones}
          onChange={(e) => set("riesgos_objeciones", e.target.value)}
          placeholder="Ej. compara con otro forwarder, requiere crédito a 30 días"
        />
      </div>
    </>
  );
}
