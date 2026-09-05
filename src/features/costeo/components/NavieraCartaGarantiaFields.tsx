/**
 * Sección "Carta Garantía" del formulario de condiciones por naviera.
 * Extraída de `NavieraCondicionForm.tsx` (Power of 10: ≤200 líneas); mismo
 * marcado y mismas reglas de captura.
 */
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { rangoLabel } from "@/lib/ui/rangoFechasCopy";
import type { NavieraCondicionInput } from "@/features/costeo/types/navieraCondicion";

interface Props {
  form: NavieraCondicionInput;
  setForm: (form: NavieraCondicionInput) => void;
}

export function NavieraCartaGarantiaFields({ form, setForm }: Props) {
  return (
  <fieldset className="rounded-md border p-3 space-y-3">
    <legend className="text-body font-medium px-1">Carta Garantía</legend>
    <div className="flex items-center gap-2">
      <Switch
        id="carta"
        checked={form.tiene_carta_garantia}
        onCheckedChange={(v) => setForm({ ...form, tiene_carta_garantia: v })}
      />
      <Label htmlFor="carta">Carta Garantía vigente (sustituye depósito de contenedor)</Label>
    </div>
    {form.tiene_carta_garantia && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="carta-vigente">{rangoLabel("Vigencia", "hasta")} *</Label>
          <DatePickerMx
            value={form.carta_garantia_vigente_hasta ?? ""}
            onChange={(v) =>
              setForm({ ...form, carta_garantia_vigente_hasta: v || null })
            }
            className="w-full"
          />
        </div>
        <div>
          <Label htmlFor="carta-folio">Folio / referencia</Label>
          <Input
            id="carta-folio"
            value={form.carta_garantia_folio ?? ""}
            onChange={(e) => setForm({ ...form, carta_garantia_folio: e.target.value || null })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="carta-notas">Notas de la carta</Label>
          <Textarea
            id="carta-notas"
            rows={2}
            value={form.carta_garantia_notas ?? ""}
            onChange={(e) => setForm({ ...form, carta_garantia_notas: e.target.value || null })}
          />
        </div>
      </div>
    )}
  </fieldset>
  );
}
