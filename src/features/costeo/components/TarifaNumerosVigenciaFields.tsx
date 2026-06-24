/**
 * Sub-componentes `NumerosFields` y `VigenciaFields` de TarifaForm.
 * Extraídos de `TarifaFormFields.tsx` en 13.133.2 para cumplir Power-of-10
 * (≤200 líneas por archivo).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TarifaInput } from "@/features/costeo/services/tarifas";

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
          type="number" min={0} step="0.01" value={form.flete_base}
          aria-invalid={errores?.flete_base || undefined}
          className={`${invalidCls(errores?.flete_base) ?? ""} ${noSpinnerCls}`}
          onChange={(e) => setForm({ ...form, flete_base: Number(e.target.value) || 0 })}
        />
      </div>
      <div>
        <Label htmlFor="tarifa-dias-libres">Días libres demoras</Label>
        <Input
          id="tarifa-dias-libres"
          type="number" min={0} value={form.dias_libres_demoras}
          className={noSpinnerCls}
          onChange={(e) => setForm({ ...form, dias_libres_demoras: Number(e.target.value) || 0 })}
        />
      </div>
      <div>
        <Label htmlFor="tarifa-transito">Tránsito (días)</Label>
        <Input
          id="tarifa-transito"
          type="number" min={0} value={form.transit_time_dias ?? ""}
          className={noSpinnerCls}
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
        <Label htmlFor="tarifa-vig-desde">Vigente desde *</Label>
        <Input
          id="tarifa-vig-desde"
          type="date" value={form.vigente_desde}
          aria-invalid={errores?.vigente_desde || undefined}
          className={invalidCls(errores?.vigente_desde)}
          onChange={(e) => setForm({ ...form, vigente_desde: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="tarifa-vig-hasta">Vigente hasta *</Label>
        <Input
          id="tarifa-vig-hasta"
          type="date" value={form.vigente_hasta}
          aria-invalid={errores?.vigente_hasta || undefined}
          className={invalidCls(errores?.vigente_hasta)}
          onChange={(e) => setForm({ ...form, vigente_hasta: e.target.value })}
        />
      </div>
    </div>
  );
}
