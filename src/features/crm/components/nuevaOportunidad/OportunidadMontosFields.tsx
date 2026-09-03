/**
 * Campos de monto, moneda, probabilidad y fechas de cierre de la oportunidad.
 * Extraído de `OportunidadFormFields.tsx` (Power of 10 #1: archivos ≤200 líneas).
 */
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Moneda } from "@/features/crm/hooks";
import type { OportunidadFormState } from "@/features/crm/hooks";

interface Props {
  form: OportunidadFormState;
  set: <K extends keyof OportunidadFormState>(k: K, v: OportunidadFormState[K]) => void;
  esGanada: boolean;
}

export default function OportunidadMontosFields({ form, set, esGanada }: Props) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="op-monto-estimado">Monto estimado</Label>
        <MoneyInput
          id="op-monto-estimado"
          value={form.monto_estimado}
          currency={form.moneda}
          onChange={(n: number) => set("monto_estimado", n)}
        />
      </div>
      <div className="space-y-1">
        <Label>Moneda</Label>
        <Select value={form.moneda} onValueChange={(v) => set("moneda", v as Moneda)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MXN">MXN</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="op-probabilidad">Probabilidad (%)</Label>
        <Input
          id="op-probabilidad"
          type="number" min={0} max={100}
          value={form.probabilidad}
          // EC-09: min/max HTML no clampean escritura manual; sin el clamp el
          // guardado explotaba contra el CHECK (probabilidad BETWEEN 0 AND 100).
          onChange={(e) => set("probabilidad", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
        />
        {(form.probabilidad < 0 || form.probabilidad > 100) && (
          <p className="text-body-sm text-destructive mt-1">La probabilidad debe estar entre 0 y 100.</p>
        )}
      </div>
      <div className="space-y-1">
        <Label>Fecha estimada cierre</Label>
        <DatePickerMx value={form.fecha_estimada_cierre} onChange={(v) => set("fecha_estimada_cierre", v)} className="w-full" />
      </div>
      {/* B-034: al cerrar en etapa "ganada" exigimos fecha y valor reales;
          sin ellos el Resumen (monto_estimado) y el Leaderboard
          (fecha_cierre_real) se contradicen. */}
      {esGanada && (
        <>
          <div className="space-y-1">
            <Label>Fecha de cierre real *</Label>
            <DatePickerMx value={form.fecha_cierre_real} onChange={(v) => set("fecha_cierre_real", v)} className="w-full" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-valor-real">Valor real</Label>
            <MoneyInput
              id="op-valor-real"
              value={form.valor_real}
              currency={form.moneda}
              onChange={(n: number) => set("valor_real", n)}
            />
          </div>
        </>
      )}
    </>
  );
}
