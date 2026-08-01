/**
 * Sub-componentes `NumerosFields` y `VigenciaFields` de TarifaForm.
 * Extraídos de `TarifaFormFields.tsx` en 13.133.2 para cumplir Power-of-10
 * (≤200 líneas por archivo).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import type { TarifaInput } from "@/features/costeo/services/tarifas";
import { RANGO_DESDE_LABEL, RANGO_HASTA_LABEL, rangoLabel } from "@/lib/ui/rangoFechasCopy";

const invalidCls = (invalid?: boolean) =>
  invalid ? "border-destructive focus-visible:ring-destructive" : undefined;

const noSpinnerCls =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

interface NumerosProps {
  form: TarifaInput;
  setForm: (f: TarifaInput) => void;
  errores?: Record<string, boolean>;
}

export function NumerosFields({ form, setForm, errores }: NumerosProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <Label htmlFor="tarifa-flete">Flete base USD *</Label>
        <Input
          id="tarifa-flete"
          type="number" min={0} step="0.01" value={form.flete_base === 0 ? "" : form.flete_base} placeholder="0.00"
          aria-invalid={errores?.flete_base || undefined}
          className={`${invalidCls(errores?.flete_base) ?? ""} ${noSpinnerCls}`}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setForm({ ...form, flete_base: Number(e.target.value) || 0 })}
        />
      </div>
      <div>
        <Label htmlFor="tarifa-dias-libres">Días libres demoras</Label>
        <Input
          id="tarifa-dias-libres"
          type="number" min={0} value={form.dias_libres_demoras === 0 ? "" : form.dias_libres_demoras} placeholder="0"
          className={noSpinnerCls}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setForm({ ...form, dias_libres_demoras: Number(e.target.value) || 0 })}
        />
      </div>
      <div>
        <Label htmlFor="tarifa-transito">Tránsito (días)</Label>
        <Input
          id="tarifa-transito"
          type="number" min={0} value={form.transit_time_dias ?? ""} placeholder="0"
          className={noSpinnerCls}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setForm({ ...form, transit_time_dias: e.target.value ? Number(e.target.value) : null })}
        />
      </div>
    </div>
  );
}

export function VigenciaFields({ form, setForm, errores }: NumerosProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor="tarifa-vig-desde">{rangoLabel("Vigencia", "desde")} *</Label>
        <DatePickerMx
          value={form.vigente_desde}
          onChange={(v) => setForm({ ...form, vigente_desde: v })}
          className={`w-full ${invalidCls(errores?.vigente_desde) ?? ""}`}
        />
      </div>
      <div>
        <Label htmlFor="tarifa-vig-hasta">{rangoLabel("Vigencia", "hasta")} *</Label>
        <DatePickerMx
          value={form.vigente_hasta}
          onChange={(v) => setForm({ ...form, vigente_hasta: v })}
          className={`w-full ${invalidCls(errores?.vigente_hasta) ?? ""}`}
        />
      </div>
    </div>
  );
}
